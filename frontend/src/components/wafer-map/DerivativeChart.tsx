import { useMemo } from "react";

interface Props {
  /** X positions in µm */
  xPositions: Float64Array;
  /** Derivative data (dZ/dX) */
  derivative: Float64Array;
  /** Indices of detected peaks in the derivative */
  peakIndices?: number[];
}

const MARGIN = { top: 8, right: 20, bottom: 30, left: 60 };
const CHART_W = 800;
const CHART_H = 120;
const TOTAL_W = CHART_W + MARGIN.left + MARGIN.right;
const TOTAL_H = CHART_H + MARGIN.top + MARGIN.bottom;

export default function DerivativeChart({
  xPositions,
  derivative,
  peakIndices,
}: Props) {
  const n = derivative.length;

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    let yLo = Infinity;
    let yHi = -Infinity;
    for (let i = 0; i < n; i++) {
      if (derivative[i] < yLo) yLo = derivative[i];
      if (derivative[i] > yHi) yHi = derivative[i];
    }
    const yPad = (yHi - yLo) * 0.1 || 1;
    return {
      xMin: xPositions[0],
      xMax: xPositions[n - 1],
      yMin: yLo - yPad,
      yMax: yHi + yPad,
    };
  }, [xPositions, derivative, n]);

  const scaleX = (val: number) =>
    MARGIN.left + ((val - xMin) / (xMax - xMin || 1)) * CHART_W;
  const scaleY = (val: number) =>
    MARGIN.top + CHART_H - ((val - yMin) / (yMax - yMin || 1)) * CHART_H;

  const linePoints = useMemo(() => {
    const step = n > 4000 ? Math.ceil(n / 2000) : 1;
    const pts: string[] = [];
    for (let i = 0; i < n; i += step) {
      pts.push(`${scaleX(xPositions[i])},${scaleY(derivative[i])}`);
    }
    if ((n - 1) % step !== 0) {
      pts.push(`${scaleX(xPositions[n - 1])},${scaleY(derivative[n - 1])}`);
    }
    return pts.join(" ");
  }, [xPositions, derivative, n, xMin, xMax, yMin, yMax]);

  // X ticks (reuse same logic)
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const range = xMax - xMin;
    const rough = range / 6;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / pow;
    let nice: number;
    if (norm < 1.5) nice = 1;
    else if (norm < 3.5) nice = 2;
    else if (norm < 7.5) nice = 5;
    else nice = 10;
    const step = nice * pow;
    const start = Math.ceil(xMin / step) * step;
    for (let v = start; v <= xMax; v += step) ticks.push(v);
    return ticks;
  }, [xMin, xMax]);

  const zeroY = scaleY(0);

  return (
    <svg
      viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
      className="w-full"
      style={{ maxHeight: 180 }}
    >
      {/* Background */}
      <rect
        x={MARGIN.left}
        y={MARGIN.top}
        width={CHART_W}
        height={CHART_H}
        fill="#fafafa"
        stroke="#e5e7eb"
      />

      {/* Zero line */}
      {zeroY >= MARGIN.top && zeroY <= MARGIN.top + CHART_H && (
        <line
          x1={MARGIN.left}
          y1={zeroY}
          x2={MARGIN.left + CHART_W}
          y2={zeroY}
          stroke="#d1d5db"
          strokeDasharray="4 2"
        />
      )}

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

      {/* Derivative line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke="#8b5cf6"
        strokeWidth={1}
        clipPath="url(#deriv-clip)"
      />

      {/* Peak markers */}
      {peakIndices?.map((idx, i) => {
        if (idx < 0 || idx >= n) return null;
        const cx = scaleX(xPositions[idx]);
        return (
          <g key={`pk${i}`}>
            <line
              x1={cx}
              y1={MARGIN.top}
              x2={cx}
              y2={MARGIN.top + CHART_H}
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="3 2"
            />
            <circle
              cx={cx}
              cy={scaleY(derivative[idx])}
              r={3}
              fill="#ef4444"
            />
          </g>
        );
      })}

      {/* Clip path */}
      <defs>
        <clipPath id="deriv-clip">
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={CHART_W}
            height={CHART_H}
          />
        </clipPath>
      </defs>

      {/* X axis ticks */}
      {xTicks.map((v) => (
        <g key={`xt${v}`}>
          <line
            x1={scaleX(v)}
            y1={MARGIN.top + CHART_H}
            x2={scaleX(v)}
            y2={MARGIN.top + CHART_H + 4}
            stroke="#9ca3af"
          />
          <text
            x={scaleX(v)}
            y={MARGIN.top + CHART_H + 15}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            {formatTick(v)}
          </text>
        </g>
      ))}

      {/* Y axis label */}
      <text
        x={12}
        y={MARGIN.top + CHART_H / 2}
        textAnchor="middle"
        fontSize={10}
        fill="#6b7280"
        transform={`rotate(-90,12,${MARGIN.top + CHART_H / 2})`}
      >
        dZ/dX
      </text>
    </svg>
  );
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}
