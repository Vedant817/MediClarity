"use client";

type TrendPoint = {
  id: string;
  value: number;
  date: string;
  flag: "normal" | "high" | "low" | "unknown";
  refMin: number | null;
  refMax: number | null;
};

const width = 760;
const height = 280;
const padding = 42;

export default function TrendChart({ points, unit }: { points: TrendPoint[]; unit: string | null }) {
  const ordered = [...points].sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf());
  if (ordered.length < 2) {
    return <div className="grid h-64 place-items-center rounded-lg border border-dashed text-sm text-gray-500">Upload another report with this test to see a trend.</div>;
  }

  const allValues = ordered.flatMap((point) => [point.value, point.refMin, point.refMax].filter((value): value is number => value != null));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || Math.max(Math.abs(max), 1);
  const yMin = min - span * 0.12;
  const yMax = max + span * 0.12;
  const x = (index: number) => padding + index * ((width - padding * 2) / (ordered.length - 1));
  const y = (value: number) => height - padding - ((value - yMin) / (yMax - yMin)) * (height - padding * 2);
  const path = ordered.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`).join(" ");
  const uniqueMinimums = [...new Set(ordered.map((point) => point.refMin).filter((value): value is number => value != null))];
  const uniqueMaximums = [...new Set(ordered.map((point) => point.refMax).filter((value): value is number => value != null))];
  const rangeLines = [
    { key: "min", value: uniqueMinimums.length === 1 ? uniqueMinimums[0] : undefined },
    { key: "max", value: uniqueMaximums.length === 1 ? uniqueMaximums[0] : undefined },
  ].filter((line): line is { key: string; value: number } => line.value != null);

  return (
    <div className="overflow-x-auto" aria-label={`Lab trend chart in ${unit ?? "reported units"}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px]" role="img">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d1d5db" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d1d5db" />
        {rangeLines.map((line) => (
          <g key={line.key}>
            <line x1={padding} y1={y(line.value)} x2={width - padding} y2={y(line.value)} stroke="#94a3b8" strokeDasharray="6 5" />
            <text x={width - padding} y={y(line.value) - 5} textAnchor="end" className="fill-slate-500 text-[10px]">reported ref {line.key} {line.value}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#0d9488" strokeWidth="3" />
        {ordered.map((point, index) => (
          <g key={point.id}>
            <circle cx={x(index)} cy={y(point.value)} r="6" fill={point.flag === "normal" ? "#0d9488" : point.flag === "unknown" ? "#64748b" : "#dc2626"}>
              <title>{`${new Date(point.date).toLocaleDateString()}: ${point.value} ${unit ?? ""} (${point.flag})`}</title>
            </circle>
            <text x={x(index)} y={height - 18} textAnchor="middle" className="fill-slate-500 text-[10px]">{new Date(point.date).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}</text>
          </g>
        ))}
        <text x={8} y={18} className="fill-slate-500 text-xs">{unit ?? "value"}</text>
      </svg>
    </div>
  );
}
