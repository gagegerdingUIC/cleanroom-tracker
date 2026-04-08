import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, X as XIcon, ChevronDown, ChevronRight, Upload } from "lucide-react";
import { api } from "../../api/client";
import type { Measurement, MeasurementPoint, ProcessStep } from "../../types";
import WaferMap from "./WaferMap";
import {
  type AlignmentPair,
  computeTransform,
  applyTransform,
  computeResidualError,
  isPairComplete,
} from "./coordTransform";
import {
  parseP7File,
  parseP7File3D,
  isP7File3D,
  extractTrace,
  type P7Profile,
} from "../../lib/profiler/p7Parser";
import ProfileAnalyzer from "./ProfileAnalyzer";

interface Props {
  step: ProcessStep;
  diameterMm: number;
  waferId: string;
  allSteps?: ProcessStep[];
}

interface LocalPoint {
  tempId: string;
  x_um: string;
  y_um: string;
  /** Raw P7 coords when entered in P7 mode */
  p7_x: string;
  p7_y: string;
  value: string;
  upperMaterial: string;
  lowerMaterial: string;
}

/** Material param names to look for in process steps, in priority order */
const MATERIAL_PARAMS = ["target", "photoresist_type"];

interface MaterialOption {
  /** Stored value, e.g. "Ti" or "Ti (#2)" for second occurrence */
  value: string;
  /** Display label, e.g. "Ti" or "Ti (#2)" */
  label: string;
}

/**
 * Build an ordered list of materials from the wafer's process history.
 * Includes duplicates — if the same material appears twice, the second
 * gets a (#2) suffix so the user can distinguish them.
 * Always starts with "Substrate".
 */
function buildMaterialOptions(steps: ProcessStep[]): MaterialOption[] {
  const rawNames: string[] = [];
  // Walk steps in order (by step_number, then created_at)
  const sorted = [...steps].sort((a, b) => {
    if (a.step_number != null && b.step_number != null)
      return a.step_number - b.step_number;
    return a.created_at.localeCompare(b.created_at);
  });
  for (const s of sorted) {
    for (const paramName of MATERIAL_PARAMS) {
      const pv = s.parameter_values.find((p) => p.param_name === paramName);
      if (pv?.value_raw) {
        rawNames.push(pv.value_raw);
      }
    }
  }

  // Build labeled options: count occurrences so far to add (#N) suffixes
  const seen = new Map<string, number>();
  // Check which names appear more than once (need suffixes only for those)
  const counts = new Map<string, number>();
  for (const n of rawNames) counts.set(n, (counts.get(n) ?? 0) + 1);

  const options: MaterialOption[] = [{ value: "Substrate", label: "Substrate" }];
  for (const name of rawNames) {
    const occ = (seen.get(name) ?? 0) + 1;
    seen.set(name, occ);
    const needsSuffix = (counts.get(name) ?? 1) > 1;
    const label = needsSuffix ? `${name} (#${occ})` : name;
    options.push({ value: label, label });
  }
  return options;
}

interface CalibrationRow {
  id: string;
  waferX: string;
  waferY: string;
  profilerX: string;
  profilerY: string;
}

let tempCounter = 0;
function nextTempId() {
  return `tmp-${++tempCounter}`;
}

type ValueUnit = "Å" | "nm" | "µm";
const UNIT_TO_NM: Record<ValueUnit, number> = { "Å": 0.1, nm: 1, "µm": 1000 };

/** Convert a value from one unit to another */
function convertValue(val: number, from: ValueUnit, to: ValueUnit): number {
  if (from === to) return val;
  return (val * UNIT_TO_NM[from]) / UNIT_TO_NM[to];
}

const inputClass =
  "w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";

function makeEmptyCalibrationRows(): CalibrationRow[] {
  return [
    { id: nextTempId(), waferX: "", waferY: "", profilerX: "", profilerY: "" },
    { id: nextTempId(), waferX: "", waferY: "", profilerX: "", profilerY: "" },
  ];
}

function loadCalibration(waferId: string): CalibrationRow[] | null {
  try {
    const raw = localStorage.getItem(`calibration-${waferId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CalibrationRow[];
  } catch {
    return null;
  }
}

function saveCalibration(waferId: string, rows: CalibrationRow[]) {
  localStorage.setItem(`calibration-${waferId}`, JSON.stringify(rows));
}

function parseOrNaN(s: string): number {
  if (s.trim() === "") return NaN;
  return parseFloat(s);
}

function rowsToPairs(rows: CalibrationRow[]): AlignmentPair[] {
  return rows.map((r) => ({
    wafer: { x: parseOrNaN(r.waferX), y: parseOrNaN(r.waferY) },
    profiler: { x: parseOrNaN(r.profilerX), y: parseOrNaN(r.profilerY) },
  }));
}

export default function MeasurementPanel({ step, diameterMm, waferId, allSteps = [] }: Props) {
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [points, setPoints] = useState<LocalPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Build material options from process history
  const materialOptions = useMemo(() => buildMaterialOptions(allSteps), [allSteps]);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved">("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calibration state
  const [calOpen, setCalOpen] = useState(false);
  const [calRows, setCalRows] = useState<CalibrationRow[]>(
    () => loadCalibration(waferId) ?? makeEmptyCalibrationRows()
  );
  const [inputUnit, setInputUnit] = useState<ValueUnit>("Å");
  const [profileQueue, setProfileQueue] = useState<P7Profile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute transform from calibration rows
  const { transform, rmsError, completePairCount } = useMemo(() => {
    const pairs = rowsToPairs(calRows);
    const t = computeTransform(pairs);
    const count = pairs.filter(isPairComplete).length;
    const err = t ? computeResidualError(t, pairs) : 0;
    return { transform: t, rmsError: err, completePairCount: count };
  }, [calRows]);

  // Persist calibration on change
  useEffect(() => {
    saveCalibration(waferId, calRows);
  }, [calRows, waferId]);

  // Extract intended value and unit from step parameters
  const intendedParam = step.parameter_values.find(
    (pv) => pv.param_name === "intended_value"
  );
  const unitParam = step.parameter_values.find(
    (pv) => pv.param_name === "unit"
  );
  const intendedValue = intendedParam?.value_numeric ?? null;
  const unit = unitParam?.value_raw ?? "nm";

  // Load existing measurement
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listMeasurements(step.id).then((measurements) => {
      if (cancelled) return;
      if (measurements.length > 0) {
        const m = measurements[0];
        setMeasurement(m);
        setPoints(
          m.points.map((p) => ({
            tempId: nextTempId(),
            x_um: String(p.x_um),
            y_um: String(p.y_um),
            p7_x: p.p7_x != null ? String(p.p7_x) : "",
            p7_y: p.p7_y != null ? String(p.p7_y) : "",
            value: String(p.value),
            upperMaterial: p.upper_material ?? "",
            lowerMaterial: p.lower_material ?? "",
          }))
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [step.id]);

  // Debounced auto-save
  const savePoints = useCallback(
    async (currentPoints: LocalPoint[], currentMeasurement: Measurement | null) => {
      const targetUnit = (unit as ValueUnit) || "nm";
      const pointsPayload = currentPoints
        .filter((p) => p.value !== "")
        .map((p) => {
          const raw = parseFloat(p.value);
          const converted =
            inputUnit !== targetUnit
              ? convertValue(raw, inputUnit, targetUnit)
              : raw;
          const p7x = parseFloat(p.p7_x);
          const p7y = parseFloat(p.p7_y);
          return {
            x_um: parseFloat(p.x_um) || 0,
            y_um: parseFloat(p.y_um) || 0,
            p7_x: isFinite(p7x) ? p7x : null,
            p7_y: isFinite(p7y) ? p7y : null,
            value: converted,
            upper_material: p.upperMaterial || null,
            lower_material: p.lowerMaterial || null,
          };
        });

      setSaveStatus("saving");
      try {
        if (currentMeasurement) {
          const updated = await api.updateMeasurement(currentMeasurement.id, {
            points: pointsPayload,
          });
          setMeasurement(updated);
        } else {
          const created = await api.createMeasurement({
            step_id: step.id,
            measurement_type: "step_height",
            instrument:
              step.parameter_values.find((pv) => pv.param_name === "instrument")
                ?.value_raw ?? "Stylus Profiler",
            intended_value: intendedValue,
            unit,
            points: pointsPayload,
          });
          setMeasurement(created);
        }
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 1500);
      } catch {
        setSaveStatus("");
      }
    },
    [step.id, step.parameter_values, intendedValue, unit, inputUnit]
  );

  const scheduleSave = useCallback(
    (newPoints: LocalPoint[], m: Measurement | null) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => savePoints(newPoints, m), 800);
    },
    [savePoints]
  );

  const addPoint = useCallback(
    (x_um: number, y_um: number) => {
      setPoints((prev) => [
        ...prev,
        { tempId: nextTempId(), x_um: String(x_um), y_um: String(y_um), p7_x: "", p7_y: "", value: "", upperMaterial: "", lowerMaterial: "" },
      ]);
    },
    []
  );

  const addManualPoint = () => {
    setPoints((prev) => [
      ...prev,
      { tempId: nextTempId(), x_um: "", y_um: "", p7_x: "", p7_y: "", value: "", upperMaterial: "", lowerMaterial: "" },
    ]);
  };

  const updatePoint = (tempId: string, field: keyof LocalPoint, val: string) => {
    setPoints((prev) => {
      const next = prev.map((p) => {
        if (p.tempId !== tempId) return p;

        if (field === "p7_x" || field === "p7_y") {
          const updated = { ...p, [field]: val };
          // Auto-compute wafer coords from P7 coords when both are filled
          const px = parseFloat(updated.p7_x);
          const py = parseFloat(updated.p7_y);
          if (transform && isFinite(px) && isFinite(py)) {
            const wafer = applyTransform(transform, { x: px, y: py });
            updated.x_um = String(Math.round(wafer.x));
            updated.y_um = String(Math.round(wafer.y));
          }
          return updated;
        }

        // All fields are stored as strings directly
        return { ...p, [field]: val };
      });

      if (
        (field === "value" || field === "p7_x" || field === "p7_y" || field === "x_um" || field === "y_um" || field === "upperMaterial" || field === "lowerMaterial") &&
        next.some((p) => p.value !== "")
      ) {
        scheduleSave(next, measurement);
      }
      return next;
    });
  };

  const removePoint = (tempId: string) => {
    setPoints((prev) => {
      const next = prev.filter((p) => p.tempId !== tempId);
      scheduleSave(next, measurement);
      return next;
    });
  };

  // Calibration row helpers
  const updateCalRow = (id: string, field: keyof CalibrationRow, val: string) => {
    setCalRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const addCalRow = () => {
    setCalRows((prev) => [
      ...prev,
      { id: nextTempId(), waferX: "", waferY: "", profilerX: "", profilerY: "" },
    ]);
  };

  const removeCalRow = (id: string) => {
    setCalRows((prev) => prev.filter((r) => r.id !== id));
  };

  // P7 file drop/open handling — supports multiple files (2D and 3D)
  const handleP7Files = useCallback(async (files: FileList | File[]) => {
    const parsed: P7Profile[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        if (isP7File3D(text)) {
          // 3D file: each trace becomes a separate profile
          const profile3D = parseP7File3D(text);
          // Use the first available section (prefer "Raw" for 3D since Intermediate may not exist)
          const sectionName = profile3D.sectionNames.includes("Raw")
            ? "Raw"
            : profile3D.sectionNames[0];
          if (sectionName) {
            const traces = profile3D.sections[sectionName];
            for (let t = 0; t < traces.length; t++) {
              parsed.push(extractTrace(profile3D, sectionName, t));
            }
          }
        } else {
          parsed.push(parseP7File(text));
        }
      } catch (err) {
        console.error("Failed to parse P7 file:", file.name, err);
      }
    }
    if (parsed.length > 0) setProfileQueue(parsed);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) handleP7Files(e.dataTransfer.files);
    },
    [handleP7Files]
  );

  const handleProfileAccept = useCallback(
    (payload: { value: number; p7_x: number; p7_y: number; upperMaterial: string; lowerMaterial: string }) => {
      const wafer =
        transform && isFinite(payload.p7_x) && isFinite(payload.p7_y)
          ? applyTransform(transform, { x: payload.p7_x, y: payload.p7_y })
          : null;

      const newPoint: LocalPoint = {
        tempId: nextTempId(),
        x_um: wafer ? String(Math.round(wafer.x)) : "",
        y_um: wafer ? String(Math.round(wafer.y)) : "",
        p7_x: String(payload.p7_x),
        p7_y: String(payload.p7_y),
        value: String(payload.value),
        upperMaterial: payload.upperMaterial,
        lowerMaterial: payload.lowerMaterial,
      };

      setPoints((prev) => {
        const next = [...prev, newPoint];
        scheduleSave(next, measurement);
        return next;
      });
    },
    [transform, scheduleSave, measurement]
  );

  // Convert local points to MeasurementPoint for the map
  const mapPoints: MeasurementPoint[] = points
    .filter((p) => p.value !== "" && p.x_um !== "" && p.y_um !== "")
    .map((p) => ({
      id: p.tempId,
      x_um: parseFloat(p.x_um) || 0,
      y_um: parseFloat(p.y_um) || 0,
      value: parseFloat(p.value),
    }));

  if (loading) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        Loading measurements...
      </div>
    );
  }

  const calSmallInput =
    "w-full border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums";

  return (
    <div className="space-y-3">
      {/* P7 Calibration: collapsible editor */}
      <div className="border rounded bg-white px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">P7 Calibration</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              transform
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {transform
              ? `RMS: ${rmsError.toFixed(0)}µm`
              : `Need ≥2 points (${completePairCount}/2)`}
          </span>
          <div className="flex-1" />
          {/* Chevron: expand/collapse calibration editor */}
          <button
            type="button"
            onClick={() => setCalOpen(!calOpen)}
            className="text-gray-400 hover:text-gray-600 p-0.5"
            title={calOpen ? "Collapse calibration" : "Edit calibration points"}
          >
            {calOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {calOpen && (
          <div className="space-y-1">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-1 items-center text-[10px] text-gray-400 font-medium">
              <span></span>
              <span>Wafer X</span>
              <span>Wafer Y</span>
              <span>P7 X (µm)</span>
              <span>P7 Y (µm)</span>
              <span></span>
            </div>
            {calRows.map((row, idx) => (
              <div
                key={row.id}
                className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-1 items-center"
              >
                <span className="text-[10px] text-gray-400 w-4">
                  {idx + 1}
                </span>
                <input
                  className={calSmallInput}
                  type="number"
                  value={row.waferX}
                  onChange={(e) => updateCalRow(row.id, "waferX", e.target.value)}
                  placeholder="µm"
                />
                <input
                  className={calSmallInput}
                  type="number"
                  value={row.waferY}
                  onChange={(e) => updateCalRow(row.id, "waferY", e.target.value)}
                  placeholder="µm"
                />
                <input
                  className={calSmallInput}
                  type="number"
                  value={row.profilerX}
                  onChange={(e) =>
                    updateCalRow(row.id, "profilerX", e.target.value)
                  }
                  placeholder="P7"
                />
                <input
                  className={calSmallInput}
                  type="number"
                  value={row.profilerY}
                  onChange={(e) =>
                    updateCalRow(row.id, "profilerY", e.target.value)
                  }
                  placeholder="P7"
                />
                <button
                  onClick={() => removeCalRow(row.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove pair"
                >
                  <XIcon size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={addCalRow}
              className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800"
            >
              <Plus size={10} />
              Add pair
            </button>
          </div>
        )}
      </div>

      {/* P7 file drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded px-3 py-2 text-center text-xs transition-colors cursor-pointer ${
          dragOver
            ? "border-blue-400 bg-blue-50 text-blue-600"
            : "border-gray-300 text-gray-400 hover:border-gray-400"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={14} className="inline mr-1 -mt-0.5" />
        Drop P7 data file(s) here or click to browse
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.dat"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleP7Files(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Profile analyzer modal */}
      {profileQueue.length > 0 && (
        <ProfileAnalyzer
          profiles={profileQueue}
          materialOptions={materialOptions}
          targetUnit={unit}
          sourceUnit="Å"
          onAccept={handleProfileAccept}
          onClose={() => setProfileQueue([])}
        />
      )}

      {/* Main content: wafer map + point list */}
      <div className="flex gap-4">
        {/* Wafer map */}
        <div className="flex-1 min-w-0">
          <div className="aspect-square max-h-[400px]">
            <WaferMap
              diameterMm={diameterMm}
              points={mapPoints}
              intendedValue={intendedValue}
              unit={unit}
              onAddPoint={addPoint}
            />
          </div>
          {intendedValue != null && (
            <div className="text-xs text-gray-500 mt-1 text-center">
              Target: {intendedValue} {unit}
            </div>
          )}
          <div className="text-xs text-gray-400 mt-0.5 text-center">
            Click wafer to add measurement point
          </div>
        </div>

        {/* Point list */}
        <div className="w-64 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              Points ({points.length})
            </span>
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && (
                <span className="text-xs text-gray-400">Saving...</span>
              )}
              {saveStatus === "saved" && (
                <span className="text-xs text-green-500">Saved</span>
              )}
              <button
                onClick={addManualPoint}
                className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800"
              >
                <Plus size={12} />
                Add Point
              </button>
            </div>
          </div>

          {/* Unit selector for Z values */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Z unit:</span>
            <select
              className="border rounded px-1 py-0.5 text-xs bg-white"
              value={inputUnit}
              onChange={(e) => setInputUnit(e.target.value as ValueUnit)}
            >
              <option value="Å">Å</option>
              <option value="nm">nm</option>
              <option value="µm">µm</option>
            </select>
          </div>

          <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
            {points.map((pt, idx) => (
              <div
                key={pt.tempId}
                className="bg-white border rounded p-2 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    #{idx + 1}
                  </span>
                  <button
                    onClick={() => removePoint(pt.tempId)}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <XIcon size={12} />
                  </button>
                </div>

                {/* P7 coordinate inputs */}
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="text-[10px] text-gray-400">X (µm)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={pt.p7_x}
                      onChange={(e) =>
                        updatePoint(pt.tempId, "p7_x", e.target.value)
                      }
                      placeholder="µm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400">Y (µm)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={pt.p7_y}
                      onChange={(e) =>
                        updatePoint(pt.tempId, "p7_y", e.target.value)
                      }
                      placeholder="µm"
                    />
                  </div>
                </div>
                {/* Computed wafer coords (read-only) */}
                {pt.x_um !== "" && pt.y_um !== "" && transform && (
                  <div className="text-[10px] text-blue-500 px-0.5 font-medium">
                    Wafer: ({pt.x_um}, {pt.y_um}) µm
                  </div>
                )}

                {/* Material description: [upper] is Z above [lower] */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <select
                      className="border rounded px-1 py-0.5 text-xs bg-white min-w-0 flex-1"
                      value={pt.upperMaterial}
                      onChange={(e) =>
                        updatePoint(pt.tempId, "upperMaterial", e.target.value)
                      }
                    >
                      <option value="">upper…</option>
                      {materialOptions.map((m, i) => (
                        <option key={i} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-gray-400 shrink-0">is</span>
                    <input
                      className="border rounded px-1.5 py-0.5 text-xs w-20 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
                      type="number"
                      value={pt.value}
                      onChange={(e) =>
                        updatePoint(pt.tempId, "value", e.target.value)
                      }
                      placeholder="Z"
                    />
                    <span className="text-[10px] text-gray-400 shrink-0">{inputUnit}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">above</span>
                    <select
                      className="border rounded px-1 py-0.5 text-xs bg-white min-w-0 flex-1"
                      value={pt.lowerMaterial}
                      onChange={(e) =>
                        updatePoint(pt.tempId, "lowerMaterial", e.target.value)
                      }
                    >
                      <option value="">lower…</option>
                      {materialOptions.map((m, i) => (
                        <option key={i} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {points.length === 0 && (
            <div className="text-xs text-gray-400 text-center py-4 border-2 border-dashed rounded">
              No measurement points yet.
              <br />
              Click the wafer map or use "+ Add Point".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
