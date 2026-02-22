/**
 * Firestore Timestamp ↔ JavaScript Date converters.
 * Firestore returns Timestamps on read; our TypeScript interfaces use Date.
 * Use these converters in service files when mapping Firestore docs to entities.
 */

import type { Timestamp } from 'firebase/firestore';

/** Converts a Firestore Timestamp (or null/undefined) to a JS Date or null */
export function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return value.toDate();
}

/** Converts a Firestore Timestamp to a JS Date (throws if null) */
export function toDateRequired(value: Timestamp | Date): Date {
  if (value instanceof Date) return value;
  return value.toDate();
}

/** Converts USD cents (integer) to a display string, e.g. 14900 → "$149.00" */
export function centsToDisplay(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/** Converts a dollar amount string to cents, e.g. "149.00" → 14900 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
