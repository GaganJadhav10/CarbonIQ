/**
 * One Chart.js theme, registered once and reused — DESIGN.md §8.
 *
 * The spec is written against Highcharts and allows Chart.js as a fallback, so
 * this maps its option block across directly: transparent background, Public
 * Sans, y-axis gridlines only, no legend for a single series, no gradient fill,
 * no shadows.
 */

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

import { readChartTokens } from './tokens';

// Tree-shakeable: register only what is used.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/**
 * Draws the value of the final point beside it (§8: "direct label the last
 * point with its value"), which removes the need for a legend on one series.
 */
export const lastPointLabel = {
  id: 'lastPointLabel',
  afterDatasetsDraw(chart, _args, options) {
    const meta = chart.getDatasetMeta(0);
    const point = meta?.data?.at(-1);
    if (!point || options?.text == null) return;

    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.font = `600 12px ${options.font}`;
    ctx.fillStyle = options.color;
    ctx.textBaseline = 'middle';

    const text = String(options.text);
    const width = ctx.measureText(text).width;
    // Flip to the left of the point when the label would overflow the canvas.
    const overflows = point.x + 8 + width > chartArea.right;
    ctx.textAlign = overflows ? 'right' : 'left';
    ctx.fillText(text, overflows ? point.x - 8 : point.x + 8, point.y);

    ctx.restore();
  },
};

ChartJS.register(lastPointLabel);

/**
 * Build the options object for a single-series time chart.
 *
 * @param {object} options
 * @param {string} options.unit       Y-axis unit, e.g. "tCO2e" or "score, 0 to 100".
 * @param {string} [options.lastLabel] Value to draw beside the final point.
 */
export function buildChartOptions({ unit, lastLabel }) {
  const t = readChartTokens();

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    layout: { padding: { top: 8, right: 44, bottom: 8 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      // One series needs no legend (§8).
      legend: { display: false },
      lastPointLabel: { text: lastLabel, color: t.series[0], font: t.font },
      tooltip: {
        backgroundColor: t.surface,
        borderColor: t.line,
        borderWidth: 1,
        titleColor: t.text,
        bodyColor: t.text,
        cornerRadius: 6,
        displayColors: false,
        padding: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: t.line },
        ticks: {
          color: t.axis,
          font: { size: 12, family: t.font },
          maxRotation: 0,
          autoSkipPadding: 24,
        },
      },
      y: {
        // §8: the y-axis label states the unit.
        title: {
          display: Boolean(unit),
          text: unit,
          color: t.axis,
          font: { size: 12, family: t.font },
        },
        grid: { color: t.grid },
        border: { display: false },
        ticks: { color: t.axis, font: { size: 12, family: t.font } },
      },
    },
  };
}

/** Build the dataset for a single series. No gradient fill (§8). */
export function buildChartData(labels, values) {
  const t = readChartTokens();

  return {
    labels,
    datasets: [
      {
        data: values,
        borderColor: t.series[0],
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: t.series[0],
      },
    ],
  };
}
