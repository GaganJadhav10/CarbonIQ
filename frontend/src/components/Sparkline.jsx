/**
 * 60 x 20 sparkline for a site row — DESIGN.md §5.3.
 *
 * Hand-drawn as an SVG path rather than pulling in a charting library for
 * twelve points: the whole component is one polyline and it inherits its colour
 * from the accent token.
 */
export default function Sparkline({ values, label }) {
  // Two points are the minimum that can express a direction.
  if (!values || values.length < 2) return null;

  const width = 60;
  const height = 20;
  const padding = 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; treat it as a mid-height line.
  const span = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / span) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? 'Recent trend'}
    >
      <polyline className="sparkline__path" points={points.join(' ')} />
    </svg>
  );
}
