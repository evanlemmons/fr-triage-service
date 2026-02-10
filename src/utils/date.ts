/**
 * Date formatting utilities for audit pages and timestamps.
 */

/**
 * Format a date as "Feb 10, 2026" (short month, day, year).
 * Uses en-US locale for consistent month abbreviations.
 *
 * @param date - Date to format. Defaults to current date.
 * @returns Formatted date string (e.g., "Feb 10, 2026")
 *
 * @example
 * formatAuditDate(new Date('2026-02-10')) // "Feb 10, 2026"
 * formatAuditDate() // Current date formatted
 */
export function formatAuditDate(date: Date = new Date()): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
