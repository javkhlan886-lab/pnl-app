interface TrendPoint {
  label: string;
  value: number;
}

interface IncomeTrendChartProps {
  data: TrendPoint[];
  formatValue: (n: number) => string;
}

// Сарын орлогын хандлагыг харуулах хөнгөн SVG шугаман график — гуравдагч
// сан (chart library) нэмэлгүйгээр, апп-ийн одоо байгаа өнгөний token-уудыг
// ашиглан зурна. Зөвхөн бодит PNL тайлангийн дүнгээр байгуулагдана.
export function IncomeTrendChart({ data, formatValue }: IncomeTrendChartProps) {
  const W = 640;
  const H = 220;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;

  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const stepX = data.length > 1 ? (W - padL - padR) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + (1 - (d.value - min) / range) * (H - padT - padB);
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${H - padB} L ${points[0].x} ${H - padB} Z`
      : "";

  if (data.length === 0) return null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      <defs>
        <linearGradient id="incomeTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(var(--positive))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="oklch(var(--positive))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Хэвтээ шугаман тор — 0 ба дундаж түвшин */}
      <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke="currentColor" strokeOpacity="0.08" />
      <line
        x1={padL} y1={H - padB} x2={W - padR} y2={H - padB}
        stroke="currentColor" strokeOpacity="0.15"
      />

      {areaPath && <path d={areaPath} fill="url(#incomeTrendFill)" />}
      <path d={linePath} fill="none" stroke="oklch(var(--positive))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="oklch(var(--positive))" />
          <text x={p.x} y={H - padB + 16} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">
            {p.label}
          </text>
        </g>
      ))}

      <text x={padL} y={padT - 4} fontSize="10" fill="currentColor" opacity="0.5">
        {formatValue(max)}
      </text>
    </svg>
  );
}
