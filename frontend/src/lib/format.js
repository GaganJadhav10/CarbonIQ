/** Display formatting helpers, kept out of component files so fast refresh works. */

/** Format an ISO date or datetime for display. */
export function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format an ISO date as a short month label for a chart axis. */
export function formatMonth(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}
