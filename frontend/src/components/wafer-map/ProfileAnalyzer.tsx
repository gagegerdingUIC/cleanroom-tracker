import { useState, useMemo, useCallback, useEffect } from "react";
import { X as XIcon, ChevronLeft, ChevronRight, Search, Activity } from "lucide-react";
import type { P7Profile } from "../../lib/profiler/p7Parser";
import {
  type AnalysisWindow,
  computeStepHeight,
  findInitialWindows,
  polyEval,
  autoLevel,
} from "../../lib/profiler/analysisEngine";
import {
  findSteps,
  type DetectedStep,
  type SmoothingMethod,
  smoothMovingAvg,
  smoothSavitzkyGolay,
  smoothGaussian,
  computeDerivative,
} from "../../lib/profiler/stepFinder";
import ProfileChart from "./ProfileChart";
import DerivativeChart from "./DerivativeChart";

interface MaterialOption {
  value: string;
  label: string;
}

interface AcceptPayload {
  value: number; // step height in target unit
  p7_x: number; // profiler stage X (µm)
  p7_y: number; // profiler stage Y (µm)
  upperMaterial: string;
  lowerMaterial: string;
}

interface Props {
  profiles: P7Profile[];
  /** Index of the currently displayed profile */
  initialIndex?: number;
  materialOptions: MaterialOption[];
  targetUnit: string;
  sourceUnit?: string;
  /** Called when user accepts — receives payload. Return true to auto-advance. */
  onAccept: (payload: AcceptPayload) => void;
  onClose: () => void;
}

type ValueUnit = "Å" | "nm" | "µm";
const UNIT_TO_NM: Record<ValueUnit, number> = { "Å": 0.1, nm: 1, "µm": 1000 };

function convertValue(val: number, from: ValueUnit, to: ValueUnit): number {
  if (from === to) return val;
  return (val * UNIT_TO_NM[from]) / UNIT_TO_NM[to];
}

type WindowMode = "level" | "measure";

/** Pick the best default column: prefer Intermediate > Raw > first available. */
function pickDefaultColumn(columnNames: string[]): string {
  const filtered = columnNames.filter((n) => n !== "Index" && n !== "index");
  if (filtered.includes("Intermediate")) return "Intermediate";
  if (filtered.includes("Raw")) return "Raw";
  return filtered[0] ?? "Raw";
}

export default function ProfileAnalyzer({
  profiles,
  initialIndex = 0,
  materialOptions,
  targetUnit,
  sourceUnit = "Å",
  onAccept,
  onClose,
}: Props) {
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const profile = profiles[currentIdx];

  const columnNames = profile.header.columnNames.filter(
    (n) => n !== "Index" && n !== "index"
  );
  const [selectedColumn, setSelectedColumn] = useState(() =>
    pickDefaultColumn(columnNames)
  );
  const [levelOrder, setLevelOrder] = useState(1);
  const [blueMaterial, setBlueMaterial] = useState("");
  const [greenMaterial, setGreenMaterial] = useState("");
  const [windowMode, setWindowMode] = useState<WindowMode>("measure");

  // --- Smoothing (independent of auto-find) ---
  const [smoothingMethod, setSmoothingMethod] = useState<SmoothingMethod>("savitzky-golay");
  const [smoothingWidth, setSmoothingWidth] = useState("10"); // µm
  const [showDerivative, setShowDerivative] = useState(false);

  // --- Auto-level override ---
  // When non-null, this leveled data overrides the window-based leveling
  const [autoLevelData, setAutoLevelData] = useState<Float64Array | null>(null);
  const [autoLevelCoeffs, setAutoLevelCoeffs] = useState<number[]>([]);

  // --- Auto-find (separate) ---
  const [autoFindOpen, setAutoFindOpen] = useState(false);
  const [minStepHeight, setMinStepHeight] = useState("500"); // Å
  const [featureWidth, setFeatureWidth] = useState("100");   // µm
  const [detectedSteps, setDetectedSteps] = useState<DetectedStep[]>([]);

  const rawData = profile.columns[selectedColumn];

  // Recompute initial windows when profile changes
  const initialWindows = useMemo(
    () => findInitialWindows(rawData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile]
  );

  const [levelLeft, setLevelLeft] = useState<AnalysisWindow>(() => ({ ...initialWindows.left }));
  const [levelRight, setLevelRight] = useState<AnalysisWindow>(() => ({ ...initialWindows.right }));
  const [measureLeft, setMeasureLeft] = useState<AnalysisWindow>(() => ({ ...initialWindows.left }));
  const [measureRight, setMeasureRight] = useState<AnalysisWindow>(() => ({ ...initialWindows.right }));

  // Reset windows when switching profiles
  useEffect(() => {
    const w = findInitialWindows(profile.columns[selectedColumn] ?? rawData);
    setLevelLeft({ ...w.left });
    setLevelRight({ ...w.right });
    setMeasureLeft({ ...w.left });
    setMeasureRight({ ...w.right });
    setWindowMode("measure");
    setDetectedSteps([]);
    setAutoLevelData(null);
    setAutoLevelCoeffs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  // --- Auto-find uses current smoothing + leveling settings ---
  const runAutoFind = useCallback(() => {
    const res = findSteps(
      profile.xPositions,
      rawData,
      {
        minStepHeight: parseFloat(minStepHeight) || 500,
        featureWidthUm: parseFloat(featureWidth) || 100,
        smoothingMethod,
        detrendOrder: levelOrder,
      },
    );
    setDetectedSteps(res.steps);
  }, [profile.xPositions, rawData, minStepHeight, featureWidth, smoothingMethod, levelOrder]);

  const stepMarkers = useMemo(
    () =>
      detectedSteps.map((s) => ({
        xUm: s.centerUm,
        label: `${convertValue(s.stepHeight, sourceUnit as ValueUnit, (targetUnit as ValueUnit) || "nm").toFixed(1)} ${targetUnit}`,
      })),
    [detectedSteps, sourceUnit, targetUnit]
  );

  // Derivative peak indices from detected steps
  const derivativePeakIndices = useMemo(() => {
    if (detectedSteps.length === 0) return undefined;
    return detectedSteps.map((s) => {
      const target = s.centerUm;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = s.edgeStartIdx; i <= s.edgeEndIdx; i++) {
        const dist = Math.abs(profile.xPositions[i] - target);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      return bestIdx;
    });
  }, [detectedSteps, profile.xPositions]);

  const activeLeft = windowMode === "level" ? levelLeft : measureLeft;
  const activeRight = windowMode === "level" ? levelRight : measureRight;

  // Manual step-height measurement (window-based) still uses raw data + leveling
  const result = useMemo(
    () =>
      computeStepHeight(
        profile.xPositions,
        rawData,
        measureLeft,
        measureRight,
        levelOrder,
        { left: levelLeft, right: levelRight }
      ),
    [profile.xPositions, rawData, measureLeft, measureRight, levelOrder, levelLeft, levelRight]
  );

  const levelCurve = useMemo(() => {
    const coeffs = autoLevelCoeffs.length > 0 ? autoLevelCoeffs : result.levelCoeffs;
    if (levelOrder === 0 || coeffs.length === 0) return null;
    const curve = new Float64Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      curve[i] = polyEval(coeffs, profile.xPositions[i]);
    }
    return curve;
  }, [levelOrder, result.levelCoeffs, autoLevelCoeffs, rawData.length, profile.xPositions]);

  // Auto-level: when active, overrides the window-based leveling
  const handleAutoLevel = useCallback(() => {
    if (levelOrder === 0) return;
    const res = autoLevel(profile.xPositions, rawData, levelOrder);
    setAutoLevelData(res.leveledData);
    setAutoLevelCoeffs(res.coeffs);
  }, [profile.xPositions, rawData, levelOrder]);

  // Clear auto-level when user changes level order or column manually
  const handleLevelOrderChange = useCallback((order: number) => {
    setLevelOrder(order);
    setAutoLevelData(null);
    setAutoLevelCoeffs([]);
  }, []);

  const displayData = autoLevelData
    ? autoLevelData
    : levelOrder > 0
      ? result.leveledData
      : rawData;

  // --- Reactive smoothing & derivative (operates on leveled data) ---
  const processedData = useMemo(() => {
    const n = displayData.length;
    if (n < 4) return { smoothed: displayData, derivative: new Float64Array(n) };

    const xRes = profile.xPositions[1] - profile.xPositions[0];
    if (xRes <= 0) return { smoothed: displayData, derivative: new Float64Array(n) };

    const widthUm = parseFloat(smoothingWidth) || 10;
    const halfWidth = Math.max(1, Math.round(widthUm / xRes / 2));

    let smoothed: Float64Array;
    switch (smoothingMethod) {
      case "savitzky-golay":
        smoothed = smoothSavitzkyGolay(displayData, halfWidth, 3);
        break;
      case "gaussian":
        smoothed = smoothGaussian(displayData, Math.max(1, halfWidth / 2));
        break;
      case "moving-average":
      default:
        smoothed = smoothMovingAvg(displayData, halfWidth);
        break;
    }

    const derivative = computeDerivative(smoothed);
    return { smoothed, derivative };
  }, [displayData, profile.xPositions, smoothingMethod, smoothingWidth]);

  const handleWindowChange = useCallback(
    (which: "left" | "right", w: AnalysisWindow) => {
      if (windowMode === "level") {
        if (which === "left") setLevelLeft(w);
        else setLevelRight(w);
      } else {
        if (which === "left") setMeasureLeft(w);
        else setMeasureRight(w);
      }
    },
    [windowMode]
  );

  const handleAccept = () => {
    const converted = convertValue(
      result.stepHeight,
      sourceUnit as ValueUnit,
      (targetUnit as ValueUnit) || "nm"
    );

    const blueIsUpper = result.left.mean >= result.right.mean;
    onAccept({
      value: Math.round(converted * 100) / 100,
      p7_x: profile.header.xCoord,
      p7_y: profile.header.yCoord,
      upperMaterial: blueIsUpper ? blueMaterial : greenMaterial,
      lowerMaterial: blueIsUpper ? greenMaterial : blueMaterial,
    });

    if (currentIdx < profiles.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    if (currentIdx < profiles.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      onClose();
    }
  };

  const stepConverted = convertValue(
    result.stepHeight,
    sourceUnit as ValueUnit,
    (targetUnit as ValueUnit) || "nm"
  );

  const isMulti = profiles.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            {isMulti && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                  className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-gray-500 tabular-nums min-w-[3em] text-center">
                  {currentIdx + 1}/{profiles.length}
                </span>
                <button
                  onClick={() => setCurrentIdx((i) => Math.min(profiles.length - 1, i + 1))}
                  disabled={currentIdx === profiles.length - 1}
                  className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-sm">
                Profile Analysis — {profile.header.dataName || profile.header.siteName || "Scan"}
              </h3>
              <span className="text-xs text-gray-500">
                Stage: ({profile.header.xCoord}, {profile.header.yCoord}) µm
                &middot; {profile.header.numPoints} pts
                &middot; Res: {profile.header.xResolution} µm
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XIcon size={16} />
          </button>
        </div>

        {/* Row 1: Data & Window controls */}
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-gray-50 text-xs flex-wrap">
          <label className="flex items-center gap-1">
            Column:
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="border rounded px-1 py-0.5 text-xs"
            >
              {columnNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1">
            Leveling:
            <select
              value={levelOrder}
              onChange={(e) => handleLevelOrderChange(Number(e.target.value))}
              className="border rounded px-1 py-0.5 text-xs"
            >
              <option value={0}>None</option>
              <option value={1}>Linear</option>
              <option value={2}>Quadratic</option>
            </select>
          </label>
          <button
            onClick={handleAutoLevel}
            disabled={levelOrder === 0}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              autoLevelData
                ? "bg-amber-200 text-amber-900 border border-amber-400"
                : levelOrder === 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
            }`}
            title="Auto-level: fit polynomial to flat regions only (excludes step edges)"
          >
            {autoLevelData ? "Auto ✓" : "Auto"}
          </button>

          <span className="text-gray-300">|</span>

          {/* Window mode toggle */}
          <div className="flex rounded overflow-hidden border">
            <button
              onClick={() => setWindowMode("level")}
              className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                windowMode === "level"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              Level Windows
            </button>
            <button
              onClick={() => setWindowMode("measure")}
              className={`px-2 py-0.5 text-xs font-medium transition-colors border-l ${
                windowMode === "measure"
                  ? "bg-blue-100 text-blue-800 border-blue-300"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              Measure Windows
            </button>
          </div>

          <span className="text-gray-400 ml-auto">
            Source unit: {sourceUnit}
          </span>
        </div>

        {/* Row 2: Smoothing & Detrend (always visible, independent) */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-violet-50/50 text-xs flex-wrap">
          <label className="flex items-center gap-1">
            Smooth:
            <select
              value={smoothingMethod}
              onChange={(e) => setSmoothingMethod(e.target.value as SmoothingMethod)}
              className="border rounded px-1 py-0.5 text-xs"
            >
              <option value="moving-average">Moving Avg</option>
              <option value="savitzky-golay">Savitzky-Golay</option>
              <option value="gaussian">Gaussian</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Width (µm):
            <input
              type="number"
              value={smoothingWidth}
              onChange={(e) => setSmoothingWidth(e.target.value)}
              className="border rounded px-1.5 py-0.5 w-16 text-xs"
              min="0.1"
              step="1"
            />
          </label>

          <span className="text-gray-300">|</span>

          <button
            onClick={() => setShowDerivative((v) => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              showDerivative
                ? "bg-purple-100 text-purple-800"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Activity size={12} />
            dZ/dX
          </button>

          <span className="text-gray-300">|</span>

          <button
            onClick={() => setAutoFindOpen((v) => !v)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              autoFindOpen
                ? "bg-red-100 text-red-800"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Search size={12} />
            Auto Find
          </button>
        </div>

        {/* Row 3: Auto-find controls (collapsible, only detection params) */}
        {autoFindOpen && (
          <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-red-50 text-xs flex-wrap">
            <label className="flex items-center gap-1">
              Min Step (Å):
              <input
                type="number"
                value={minStepHeight}
                onChange={(e) => setMinStepHeight(e.target.value)}
                className="border rounded px-1.5 py-0.5 w-20 text-xs"
              />
            </label>
            <label className="flex items-center gap-1">
              Feature Width (µm):
              <input
                type="number"
                value={featureWidth}
                onChange={(e) => setFeatureWidth(e.target.value)}
                className="border rounded px-1.5 py-0.5 w-20 text-xs"
              />
            </label>
            <button
              onClick={runAutoFind}
              className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
            >
              Find Steps
            </button>
            {detectedSteps.length > 0 && (
              <span className="text-red-700 font-medium">
                {detectedSteps.length} step{detectedSteps.length !== 1 ? "s" : ""} found
              </span>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="flex-1 overflow-auto px-2 py-2">
          <ProfileChart
            xPositions={profile.xPositions}
            data={displayData}
            left={activeLeft}
            right={activeRight}
            leftMean={windowMode === "measure" ? result.left.mean : 0}
            rightMean={windowMode === "measure" ? result.right.mean : 0}
            onWindowChange={handleWindowChange}
            levelCurve={levelOrder > 0 && windowMode === "level" ? levelCurve : null}
            windowColor={windowMode === "level" ? "amber" : "blue"}
            stepMarkers={detectedSteps.length > 0 ? stepMarkers : undefined}
          />

          {/* Derivative chart (independent toggle, always available) */}
          {showDerivative && (
            <div className="mt-1">
              <DerivativeChart
                xPositions={profile.xPositions}
                derivative={processedData.derivative}
                peakIndices={derivativePeakIndices}
              />
            </div>
          )}
        </div>

        {/* Auto-find results list */}
        {detectedSteps.length > 0 && autoFindOpen && (
          <div className="border-t px-4 py-2 max-h-32 overflow-y-auto bg-red-50/50">
            <div className="text-xs font-medium text-gray-500 mb-1">Detected Steps</div>
            <div className="space-y-1">
              {detectedSteps.map((step, i) => {
                const converted = convertValue(
                  step.stepHeight,
                  sourceUnit as ValueUnit,
                  (targetUnit as ValueUnit) || "nm"
                );
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs bg-white rounded px-2 py-1 border"
                  >
                    <span className="text-gray-500 w-6">#{i + 1}</span>
                    <span className="font-mono">
                      {step.centerUm.toFixed(0)} µm
                    </span>
                    <span className="font-bold text-red-700">
                      {converted.toFixed(1)} {targetUnit}
                    </span>
                    <span className="text-gray-400">
                      ({step.stepHeight.toFixed(0)} {sourceUnit})
                    </span>
                    <button
                      onClick={() => {
                        onAccept({
                          value: Math.round(converted * 100) / 100,
                          p7_x: profile.header.xCoord,
                          p7_y: profile.header.yCoord,
                          upperMaterial: step.leftMean >= step.rightMean ? blueMaterial : greenMaterial,
                          lowerMaterial: step.leftMean >= step.rightMean ? greenMaterial : blueMaterial,
                        });
                      }}
                      className="ml-auto px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Accept
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Results bar */}
        <div className="border-t px-4 py-3 bg-gray-50">
          <div className="flex items-end gap-6 text-xs">
            {/* Step height */}
            <div className="text-center">
              <div className="text-gray-500 mb-0.5">Step Height</div>
              <div className="text-lg font-bold text-blue-700">
                {stepConverted.toFixed(1)} {targetUnit}
              </div>
              <div className="text-gray-400">
                ({result.stepHeight.toFixed(1)} {sourceUnit})
              </div>
            </div>

            {/* Blue (left) window */}
            <div>
              <div className="text-blue-600 font-medium mb-0.5">Blue (Left)</div>
              <div>Mean: {result.left.mean.toFixed(1)} {sourceUnit}</div>
              <div>Ra: {result.left.ra.toFixed(2)} &middot; Rq: {result.left.rq.toFixed(2)}</div>
              <select
                value={blueMaterial}
                onChange={(e) => setBlueMaterial(e.target.value)}
                className="border rounded px-1 py-0.5 text-xs w-28 mt-1"
              >
                <option value="">material…</option>
                {materialOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Green (right) window */}
            <div>
              <div className="text-green-600 font-medium mb-0.5">Green (Right)</div>
              <div>Mean: {result.right.mean.toFixed(1)} {sourceUnit}</div>
              <div>Ra: {result.right.ra.toFixed(2)} &middot; Rq: {result.right.rq.toFixed(2)}</div>
              <select
                value={greenMaterial}
                onChange={(e) => setGreenMaterial(e.target.value)}
                className="border rounded px-1 py-0.5 text-xs w-28 mt-1"
              >
                <option value="">material…</option>
                {materialOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex items-end gap-2">
              {isMulti && (
                <button
                  onClick={handleSkip}
                  className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-100"
                >
                  Skip
                </button>
              )}
              <button
                onClick={handleAccept}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
              >
                {isMulti && currentIdx < profiles.length - 1
                  ? "Accept & Next"
                  : "Accept & Close"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
