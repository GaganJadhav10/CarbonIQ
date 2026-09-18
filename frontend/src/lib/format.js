/**
 * Display formatting — DESIGN.md §10.
 *
 * Units and formats are fixed here so they read identically everywhere: area in
 * hectares with thousands separators, coordinates to four decimals with a
 * hemisphere letter, dates like "12 Mar 2025".
 */

/** "12 Mar 2025" */
export function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Mar 2025", for chart axes. */
export function formatMonth(value) {
  return new Date(value).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/** "3 days ago". Relative time, for the ledger's last-updated column (§5.2). */
export function formatRelative(value) {
  if (!value) return '—';

  const then = new Date(value).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;

  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/** "1,240 ha" — no more than two decimals, thousands separated (§7). */
export function formatArea(hectares) {
  if (hectares == null) return '—';
  return `${hectares.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ha`;
}

/** Number with a fixed number of decimals and thousands separators. */
export function formatNumber(value, decimals = 1) {
  if (value == null) return '—';
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * "21.9400° N, 89.1800° E" (§10).
 *
 * Four decimals is roughly 11 m at the equator, which is the right precision
 * for a site boundary readout.
 */
export function formatCoordinates(lng, lat) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

/** Signed change, e.g. "+6.2". The sign carries the meaning, not the colour (§11). */
export function formatChange(value, decimals = 1) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
