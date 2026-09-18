import { useMemo } from 'react';
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
import { useTheme } from '../lib/theme-context';
import { readChartTokens } from '../lib/tokens';

// Chart.js v4 is tree-shakeable: registering only what is used keeps the rest
// out of the bundle.
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

/**
 * Vertical gradient from the series colour down to transparent.
 *
 * Supplied as a function so Chart.js calls it with a live canvas context --
 * a gradient built eagerly has no canvas to attach to on first render.
 */
function areaGradient(colorStrong, colorSoft) {
  return (context) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return colorSoft;

    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, colorStrong);
    gradient.addColorStop(1, colorSoft);
    return gradient;
  };
}

/**
 * Time-series line chart for one or more metrics.
 *
 * Every colour is read from CSS custom properties at render time and the chart
 * is keyed on the resolved theme, so switching to dark mode restyles the axes,
 * grid and series rather than leaving dark-grey text on a near-black surface.
 *
 * The y-axis is deliberately not zero-based: a restoration trend from 120 to
 * 320 tCO2e is the story, and zero-basing would flatten it into a barely
 * visible slope. Axis titles carry the unit so the scale is never ambiguous.
 */
export default function MetricsChart({ series, compare = false }) {
  const { resolved } = useTheme();

  const { data, options } = useMemo(() => {
    const tokens = readChartTokens();
    const list = Array.isArray(series) ? series : [series];
    const primary = list[0];

    const labels = primary.points.map((point) => formatMonth(point.recorded_at));

    const datasets = list.map((entry, index) => {
      const color = tokens.series[index % tokens.series.length];
      const unit = entry.unit ?? '';
      const label = metricLabel(entry.metric_name);

      return {
        label: unit ? `${label} (${unit})` : label,
        data: entry.points.map((point) => point.value),
        borderColor: color,
        backgroundColor:
          list.length === 1 ? areaGradient(tokens.fillStrong, tokens.fillSoft) : 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        pointBorderColor: tokens.surface,
        pointBorderWidth: 2,
        tension: 0.32,
        fill: list.length === 1,
        // Each metric gets its own axis when comparing, because tCO2e, percent
        // and species counts share no meaningful scale.
        yAxisID: compare ? `y${index}` : 'y',
      };
    });

    const scales = {
      x: {
        title: { display: true, text: 'Month', color: tokens.axis },
        grid: { display: false },
        border: { color: tokens.border },
        ticks: { color: tokens.axis, maxRotation: 0, autoSkipPadding: 20 },
      },
    };

    if (compare) {
      list.forEach((entry, index) => {
        scales[`y${index}`] = {
          display: index === 0,
          position: index === 0 ? 'left' : 'right',
          grid: { color: index === 0 ? tokens.grid : 'transparent' },
          border: { display: false },
          ticks: { color: tokens.axis },
          beginAtZero: false,
        };
      });
    } else {
      const unit = primary.unit ?? '';
      const label = metricLabel(primary.metric_name);
      scales.y = {
        title: { display: true, text: unit ? `${label} (${unit})` : label, color: tokens.axis },
        grid: { color: tokens.grid },
        border: { display: false },
        ticks: { color: tokens.axis },
        beginAtZero: false,
      };
    }

    return {
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        font: { family: tokens.fontSans },
        plugins: {
          legend: {
            display: compare || list.length > 1,
            position: 'top',
            align: 'end',
            labels: {
              color: tokens.text,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: tokens.text,
            titleColor: tokens.surface,
            bodyColor: tokens.surface,
            padding: 10,
            cornerRadius: 8,
            displayColors: list.length > 1,
            callbacks: {
              label: (context) => {
                const entry = list[context.datasetIndex];
                const unit = entry.unit ? ` ${entry.unit}` : '';
                return ` ${metricLabel(entry.metric_name)}: ${context.parsed.y}${unit}`;
              },
            },
          },
        },
        scales,
      },
    };
    // `resolved` is not read directly here, but every token above changes with
    // it, so it belongs in the dependency list.
  }, [series, compare, resolved]);

  return (
    <div className="chart-frame">
      <Line
        // Remounting on theme change lets Chart.js rebuild its canvas cleanly
        // rather than animating between two palettes.
        key={resolved}
        data={data}
        options={options}
        aria-label="Metric values over time"
      />
    </div>
  );
}
