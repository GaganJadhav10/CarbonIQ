import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import { formatMonth } from '../lib/format';
import { metricLabel } from '../lib/metrics';

// Chart.js v4 is tree-shakeable: only the pieces actually used are registered,
// which keeps them out of the bundle if this component is ever code-split.
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const SERIES_COLOR = '#0f766e';

/**
 * Time-series line chart for one metric.
 *
 * Axis titles carry the unit, the tooltip restates it per point, and the y-axis
 * is not forced to zero -- a restoration trend of 120 -> 320 tCO2e is the story,
 * and zero-basing would flatten it into a barely visible slope.
 */
export default function MetricsChart({ series }) {
  const label = metricLabel(series.metric_name);
  const unit = series.unit ?? '';

  const data = {
    labels: series.points.map((point) => formatMonth(point.recorded_at)),
    datasets: [
      {
        label: unit ? `${label} (${unit})` : label,
        data: series.points.map((point) => point.value),
        borderColor: SERIES_COLOR,
        backgroundColor: 'rgba(15, 118, 110, 0.12)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', align: 'end' },
      tooltip: {
        callbacks: {
          label: (context) =>
            unit ? `${label}: ${context.parsed.y} ${unit}` : `${label}: ${context.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Month' },
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkipPadding: 16 },
      },
      y: {
        title: { display: true, text: unit ? `${label} (${unit})` : label },
        beginAtZero: false,
      },
    },
  };

  return (
    <div className="chart-frame">
      <Line data={data} options={options} aria-label={`${label} over time`} />
    </div>
  );
}
