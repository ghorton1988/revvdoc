/**
 * Display formatters for dates, currency, distances, and durations.
 */

/** Formats USD cents to a display string: 14900 → "$149.00" */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'FREE';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Formats a Date to a short calendar display: "Mar 15, 2025" */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Formats a Date to time: "2:30 PM" */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Formats a Date range: "Mar 15 – Mar 18, 2025" */
export function formatDateRange(start: Date, end: Date): string {
  const startStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start);
  const endStr = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end);
  return `${startStr} – ${endStr}`;
}

/** Formats service duration: 90 → "1h 30m", 60 → "1h", 30 → "30m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Formats mileage with commas: 12500 → "12,500 mi" */
export function formatMileage(miles: number): string {
  return `${miles.toLocaleString('en-US')} mi`;
}

/** Relative time display: "2 hours ago", "just now" */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
