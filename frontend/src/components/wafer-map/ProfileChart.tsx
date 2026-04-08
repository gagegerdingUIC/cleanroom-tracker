import { useRef, useState, useCallback, useMemo } from "react";
import type { AnalysisWindow } from "../../lib/profiler/analysisEngine";

interface Props {
  /** X positions in µm */
  xPositions: Float64Array;
  /** Height data (raw or leveled) in source units */
  data: Float64Array;
  /** Left measurement window */
  left: AnalysisWindow;
  /** Right measurement window */
  right: AnalysisWindow;
  /** Mean value for each window (for drawing dashed mean lines) */
  leftMean: number;
  rightMean: number;
  /** Called when a window handle drag ends */
  onWindowChange: (
    which: "left" | "right",
    window: AnalysisWindow
  ) => void;
  /** Optional leveling polynomial curve data for overlay */
  levelCurve?: Float64Array | null;
  /** Color scheme for windows: "blue" (default) for measure, "amber" for level */
  windowColor?: "blue" | "amber";
  /** Optional step markers from auto-find (vertical lines with labels) */
  stepMarkers?: { xUm: number; label: string }[];
}

/** Which handle is being dragged */
type DragTarget =
  | { which: "left"; edge: "start" | "end" | "body" }
  | { which: "right"; edge: "start" | "end" | "body" }
  | null;

// Chart layout constants
const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 };
const CHART_W = 800;
const CHART_H = 300;
const TOTAL_W = CHART_W + MARGIN.left + MARGIN.right;
const TOTAL_H = CHART_H + MARGIN.top + MARGIN.bottom;
const HANDLE_HIT_WIDTH = 12; // invisible hit area width in SVG units

export default function ProfileChart({
  xPositions,
  data,
  left,
  right,
  leftMean,
  rightMean,
  onWindowChange,
  levelCurve,
  windowColor = "blue",
  stepMarkers,
}: Props) {
  // Color palette based on mode
  const leftColor = windowColor === "amber" ? { fill: "#f59e0b", stroke: "#d97706", handle: "#b45309" }
    : { fill: "#3b82f6", stroke: "#2563eb", handle: "#2563eb" };
  const rightColor = windowColor === "amber" ? { fill: "#fbbf24", stroke: "#f59e0b", handle: "#d97706" }
    : { fill: "#22c55e", stroke: "#16a34a", handle: "#16a34a" };
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragTarget>(null);
  const tempWindowRef = useRef<{ left: AnalysisWindow; right: AnalysisWindow }>({
    left: { ...left },
    right: { ...right },
  });
  // Track drag position so handles visually follow the cursor during drag
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // For body drag: offset from cursor index to window start at grab time
  const bodyGrabOffsetRef = useRef(0);

  const n = data.length;

  // Compute axis ranges
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    let yLo = Infinity;
    let yHi = -Infinity;
    for (let i = 0; i < n; i++) {
      if (data[i] < yLo) yLo = data[i];
      if (data[i] > yHi) yHi = data[i];
    }
    const yPad = (yHi - yLo) * 0.08 || 1;
    return {
      xMin: xPositions[0],
      xMax: xPositions[n - 1],
      yMin: yLo - yPad,
      yMax: yHi + yPad,
    };
  }, [xPositions, data, n]);

  // Scale functions
  const scaleX = useCallback(
    (val: number) =>
      MARGIN.left +
      ((val - xMin) / (xMax - xMin || 1)) * CHART_W,
    [xMin, xMax]
  );
  const scaleY = useCallback(
    (val: number) =>
      MARGIN.top +
      CHART_H -
      ((val - yMin) / (yMax - yMin || 1)) * CHART_H,
    [yMin, yMax]
  );
  const indexFromSvgX = useCallback(
    (svgX: number) => {
      const frac = (svgX - MARGIN.left) / CHART_W;
      return Math.round(frac * (n - 1));
    },
    [n]
  );

  // Build polyline points string (downsample if > 4000 points)
  const profilePoints = useMemo(() => {
    const step = n > 4000 ? Math.ceil(n / 2000) : 1;
    const pts: string[] = [];
    for (let i = 0; i < n; i += step) {
      pts.push(`${scaleX(xPositions[i])},${scaleY(data[i])}`);
    }
    if ((n - 1) % step !== 0) {
      pts.push(`${scaleX(xPositions[n - 1])},${scaleY(data[n - 1])}`);
    }
    return pts.join(" ");
  }, [xPositions, data, n, scaleX, scaleY]);

  // Level curve polyline (if provided)
  const levelCurvePoints = useMemo(() => {
    if (!levelCurve) return null;
    const step = n > 4000 ? Math.ceil(n / 2000) : 1;
    const pts: string[] = [];
    for (let i = 0; i < n; i += step) {
      pts.push(`${scaleX(xPositions[i])},${scaleY(levelCurve[i])}`);
    }
    return pts.join(" ");
  }, [levelCurve, xPositions, n, scaleX, scaleY]);

  // Tick generation
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const range = xMax - xMin;
    const step = niceStep(range, 6);
    const start = Math.ceil(xMin / step) * step;
    for (let v = start; v <= xMax; v += step) ticks.push(v);
    return ticks;
  }, [xMin, xMax]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const range = yMax - yMin;
    const step = niceStep(range, 5);
    const start = Math.ceil(yMin / step) * step;
    for (let v = start; v <= yMax; v += step) ticks.push(v);
    return ticks;
  }, [yMin, yMax]);

  // --- Drag handlers (move/up live on the SVG root) ---

  const clampIndex = (idx: number) => Math.max(0, Math.min(n - 1, idx));

  const svgPointFromEvent = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current!;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM()!.inverse());
    },
    []
  );

  const handlePointerDown = useCallback(
    (target: DragTarget) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      svgRef.current!.setPointerCapture(e.pointerId);
      dragRef.current = target;
      tempWindowRef.current = { left: { ...left }, right: { ...right } };

      // For body drags, record offset from cursor to window start
      if (target?.edge === "body") {
        const svgPt = svgPointFromEvent(e);
        const idx = clampIndex(indexFromSvgX(svgPt.x));
        const w = target.which === "left" ? left : right;
        bodyGrabOffsetRef.current = idx - w.start;
      }
    },
    [left, right, svgPointFromEvent, indexFromSvgX]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !svgRef.current) return;
      const svgPt = svgPointFromEvent(e);
      const idx = clampIndex(indexFromSvgX(svgPt.x));

      const { which, edge } = dragRef.current;
      const tw = tempWindowRef.current;

      if (edge === "body") {
        // Move entire window, preserving its width
        const w = which === "left" ? tw.left : tw.right;
        const width = w.end - w.start;
        let newStart = idx - bodyGrabOffsetRef.current;

        // Clamp to data bounds
        newStart = Math.max(0, Math.min(newStart, n - 1 - width));

        // Prevent overlap with the other window
        if (which === "left") {
          newStart = Math.min(newStart, tw.right.start - width - 1);
          tw.left.start = newStart;
          tw.left.end = newStart + width;
        } else {
          newStart = Math.max(newStart, tw.left.end + 1);
          // Re-clamp end after adjusting start
          if (newStart + width > n - 1) newStart = n - 1 - width;
          tw.right.start = newStart;
          tw.right.end = newStart + width;
        }
      } else if (which === "left") {
        if (edge === "start") {
          tw.left.start = Math.min(idx, tw.left.end - 1);
        } else {
          tw.left.end = Math.min(
            Math.max(idx, tw.left.start + 1),
            tw.right.start - 1
          );
        }
      } else {
        if (edge === "start") {
          tw.right.start = Math.min(
            Math.max(idx, tw.left.end + 1),
            tw.right.end - 1
          );
        } else {
          tw.right.end = Math.max(idx, tw.right.start + 1);
        }
      }

      setDragIdx(idx);
    },
    [indexFromSvgX, svgPointFromEvent]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      svgRef.current?.releasePointerCapture(e.pointerId);
      const { which } = dragRef.current;
      const tw = tempWindowRef.current;
      onWindowChange(which, { ...tw[which] });
      dragRef.current = null;
      setDragIdx(null);
    },
    [onWindowChange]
  );

  // Resolve effective window indices (use temp values during drag)
  const effLeft = dragRef.current ? tempWindowRef.current.left : left;
  const effRight = dragRef.current ? tempWindowRef.current.right : right;
  // Force recalc when dragIdx changes (otherwise effLeft/effRight are stale refs)
  void dragIdx;

  // Window rect helpers
  const windowRect = (w: AnalysisWindow, color: string, which: "left" | "right") => {
    const x1 = scaleX(xPositions[w.start]);
    const x2 = scaleX(xPositions[w.end]);
    return (
      <rect
        x={x1}
        y={MARGIN.top}
        width={x2 - x1}
        height={CHART_H}
        fill={color}
        opacity={0.12}
        style={{ cursor: "grab" }}
        onPointerDown={handlePointerDown({ which, edge: "body" })}
      />
    );
  };

  const handleLine = (
    idx: number,
    color: string,
    target: DragTarget
  ) => {
    const cx = scaleX(xPositions[idx]);
    return (
      <g>
        {/* Wide invisible hit area */}
        <rect
          x={cx - HANDLE_HIT_WIDTH / 2}
          y={MARGIN.top}
          width={HANDLE_HIT_WIDTH}
          height={CHART_H}
          fill="transparent"
          style={{ cursor: "ew-resize" }}
          onPointerDown={handlePointerDown(target)}
        />
        {/* Visible dashed line */}
        <line
          x1={cx}
          y1={MARGIN.top}
          x2={cx}
          y2={MARGIN.top + CHART_H}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 2"
          pointerEvents="none"
        />
      </g>
    );
  };

  const meanLine = (mean: number, x1Idx: number, x2Idx: number, color: string) => {
    const y = scaleY(mean);
    return (
      <line
        x1={scaleX(xPositions[x1Idx])}
        y1={y}
        x2={scaleX(xPositions[x2Idx])}
        y2={y}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="6 3"
        pointerEvents="none"
      />
    );
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
      className="w-full"
      style={{ maxHeight: 360, touchAction: "none" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Clip path for chart area */}
      <defs>
        <clipPath id="chart-clip">
          <rect x={MARGIN.left} y={MARGIN.top} width={CHART_W} height={CHART_H} />
        </clipPath>
      </defs>

      {/* Chart background */}
      <rect
        x={MARGIN.left}
        y={MARGIN.top}
        width={CHART_W}
        height={CHART_H}
        fill="#fafafa"
        stroke="#e5e7eb"
      />

      {/* Grid lines */}
      {xTicks.map((v) => (
        <line
          key={`xg${v}`}
          x1={scaleX(v)}
          y1={MARGIN.top}
          x2={scaleX(v)}
          y2={MARGIN.top + CHART_H}
          stroke="#f0f0f0"
        />
      ))}
      {yTicks.map((v) => (
        <line
          key={`yg${v}`}
          x1={MARGIN.left}
          y1={scaleY(v)}
          x2={MARGIN.left + CHART_W}
          y2={scaleY(v)}
          stroke="#f0f0f0"
        />
      ))}

      {/* Window shading */}
      {windowRect(effLeft, leftColor.fill, "left")}
      {windowRect(effRight, rightColor.fill, "right")}

      {/* Profile line */}
      <g clipPath="url(#chart-clip)">
        <polyline
          points={profilePoints}
          fill="none"
          stroke="#374151"
          strokeWidth={1}
          pointerEvents="none"
        />
        {/* Level curve overlay */}
        {levelCurvePoints && (
          <polyline
            points={levelCurvePoints}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.7}
            pointerEvents="none"
          />
        )}
      </g>

      {/* Mean lines */}
      {meanLine(leftMean, effLeft.start, effLeft.end, leftColor.stroke)}
      {meanLine(rightMean, effRight.start, effRight.end, rightColor.stroke)}

      {/* Draggable handles — rendered last so they're on top */}
      {handleLine(effLeft.start, leftColor.handle, { which: "left", edge: "start" })}
      {handleLine(effLeft.end, leftColor.handle, { which: "left", edge: "end" })}
      {handleLine(effRight.start, rightColor.handle, { which: "right", edge: "start" })}
      {handleLine(effRight.end, rightColor.handle, { which: "right", edge: "end" })}

      {/* X axis ticks & labels */}
      {xTicks.map((v) => (
        <g key={`xt${v}`}>
          <line
            x1={scaleX(v)}
            y1={MARGIN.top + CHART_H}
            x2={scaleX(v)}
            y2={MARGIN.top + CHART_H + 5}
            stroke="#9ca3af"
          />
          <text
            x={scaleX(v)}
            y={MARGIN.top + CHART_H + 18}
            textAnchor="middle"
            fontSize={10}
            fill="#6b7280"
          >
            {formatTick(v)}
          </text>
        </g>
      ))}

      {/* Y axis ticks & labels */}
      {yTicks.map((v) => (
        <g key={`yt${v}`}>
          <line
            x1={MARGIN.left - 5}
            y1={scaleY(v)}
            x2={MARGIN.left}
            y2={scaleY(v)}
            stroke="#9ca3af"
          />
          <text
            x={MARGIN.left - 8}
            y={scaleY(v) + 3}
            textAnchor="end"
            fontSize={10}
            fill="#6b7280"
          >
            {formatTick(v)}
          </text>
        </g>
      ))}

      {/* Auto-find step markers */}
      {stepMarkers?.map((m, i) => {
        const cx = scaleX(m.xUm);
        return (
          <g key={`sm${i}`}>
            <line
              x1={cx}
              y1={MARGIN.top}
              x2={cx}
              y2={MARGIN.top + CHART_H}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
            <text
              x={cx + 3}
              y={MARGIN.top + 14 + (i % 2) * 14}
              fontSize={9}
              fill="#ef4444"
              fontWeight="bold"
              pointerEvents="none"
            >
              {m.label}
            </text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text
        x={MARGIN.left + CHART_W / 2}
        y={TOTAL_H - 4}
        textAnchor="middle"
        fontSize={11}
        fill="#6b7280"
      >
        Scan Position (µm)
      </text>
      <text
        x={12}
        y={MARGIN.top + CHART_H / 2}
        textAnchor="middle"
        fontSize={11}
        fill="#6b7280"
        transform={`rotate(-90,12,${MARGIN.top + CHART_H / 2})`}
      >
        Height (Å)
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3.5) nice = 2;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  return nice * pow;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}
