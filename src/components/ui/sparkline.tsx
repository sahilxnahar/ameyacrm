/**
 * A tiny inline trend line (V3). Pure SVG, no library — turns a row of numbers
 * into a shape that tells a story at a glance next to a KPI.
 */
export function Sparkline({
  data, width = 72, height = 22, className, strokeClass = 'stroke-[color:hsl(var(--primary))]',
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeClass?: string;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${points.join(' L ')}`;
  const last = points[points.length - 1]!.split(',');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <path d={d} fill="none" className={strokeClass} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={1.8} className="fill-[color:hsl(var(--primary))]" />
    </svg>
  );
}
