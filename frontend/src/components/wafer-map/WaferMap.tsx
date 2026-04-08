import { useRef, useCallback } from "react";
import type { MeasurementPoint } from "../../types";

interface Props {
  diameterMm: number;
  points: MeasurementPoint[];
  intendedValue?: number | null;
  unit?: string;
  onAddPoint?: (x_um: number, y_um: number) => void;
}

export default function WaferMap({
  diameterMm,
  points,
  intendedValue,
  unit = "nm",
  onAddPoint,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const radiusUm = (diameterMm * 1000) / 2;
  // Standard flat inset: ~1.5% of diameter
  const flatInset = radiusUm * 0.03;
  const flatY = radiusUm - flatInset;
  // Half-chord at flat Y position
  const flatHalfChord = Math.sqrt(radiusUm * radiusUm - flatY * flatY);

  // SVG viewBox: centered at 0,0, with some padding
  const pad = radiusUm * 0.12;
  const vbSize = (radiusUm + pad) * 2;

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onAddPoint || !svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      // SVG coords → wafer coords (SVG y is inverted)
      const x_um = Math.round(svgPt.x);
      const y_um = Math.round(-svgPt.y);
      // Check if inside wafer
      if (x_um * x_um + y_um * y_um > radiusUm * radiusUm) return;
      onAddPoint(x_um, y_um);
    },
    [onAddPoint, radiusUm]
  );

  // Color scale for deviation from intended value
  const getPointColor = (value: number) => {
    if (intendedValue == null || intendedValue === 0) return "#3b82f6";
    const deviation = Math.abs(value - intendedValue) / intendedValue;
    if (deviation < 0.05) return "#22c55e"; // green — within 5%
    if (deviation < 0.15) return "#eab308"; // yellow — within 15%
    return "#ef4444"; // red — >15%
  };

  const pointRadius = radiusUm * 0.025;
  const fontSize = radiusUm * 0.05;

  // Grid lines
  const gridStep = radiusUm > 30000 ? 10000 : 5000;
  const gridLines: number[] = [];
  for (let g = -radiusUm; g <= radiusUm; g += gridStep) {
    if (g !== 0) gridLines.push(g);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${-radiusUm - pad} ${-radiusUm - pad} ${vbSize} ${vbSize}`}
      className="w-full h-full"
      style={{ cursor: onAddPoint ? "crosshair" : "default" }}
      onClick={handleClick}
    >
      {/* Grid */}
      {gridLines.map((g) => (
        <g key={g}>
          <line
            x1={g} y1={-radiusUm} x2={g} y2={radiusUm}
            stroke="#e5e7eb" strokeWidth={radiusUm * 0.002}
          />
          <line
            x1={-radiusUm} y1={g} x2={radiusUm} y2={g}
            stroke="#e5e7eb" strokeWidth={radiusUm * 0.002}
          />
        </g>
      ))}
      {/* Axes */}
      <line x1={-radiusUm} y1={0} x2={radiusUm} y2={0} stroke="#d1d5db" strokeWidth={radiusUm * 0.003} />
      <line x1={0} y1={-radiusUm} x2={0} y2={radiusUm} stroke="#d1d5db" strokeWidth={radiusUm * 0.003} />

      {/* Wafer outline with flat at bottom (positive SVG y = negative wafer y = flat side) */}
      <path
        d={`
          M ${-flatHalfChord} ${flatY}
          A ${radiusUm} ${radiusUm} 0 1 1 ${flatHalfChord} ${flatY}
          Z
        `}
        fill="#f8fafc"
        stroke="#94a3b8"
        strokeWidth={radiusUm * 0.005}
      />

      {/* Flat label */}
      <text
        x={0}
        y={flatY + fontSize * 1.5}
        textAnchor="middle"
        fontSize={fontSize * 0.8}
        fill="#94a3b8"
      >
        flat
      </text>

      {/* Measurement points — note y is negated for SVG */}
      {points.map((pt) => (
        <g key={pt.id}>
          <circle
            cx={pt.x_um}
            cy={-pt.y_um}
            r={pointRadius}
            fill={getPointColor(pt.value)}
            stroke="white"
            strokeWidth={radiusUm * 0.003}
          />
          <text
            x={pt.x_um}
            y={-pt.y_um - pointRadius * 1.5}
            textAnchor="middle"
            fontSize={fontSize * 0.8}
            fill="#374151"
          >
            {pt.value}{unit}
          </text>
        </g>
      ))}

      {/* Diameter label */}
      <text
        x={-radiusUm - pad * 0.3}
        y={-radiusUm - pad * 0.3}
        fontSize={fontSize * 0.7}
        fill="#9ca3af"
      >
        {diameterMm}mm ({radiusUm * 2}µm)
      </text>
    </svg>
  );
}
