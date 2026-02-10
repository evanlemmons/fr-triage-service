import { describe, it, expect } from 'vitest';
import { formatAuditDate } from '../../../src/utils/date.js';

describe('formatAuditDate', () => {
  it('formats date with short month name', () => {
    const date = new Date('2026-02-10T12:00:00Z');
    expect(formatAuditDate(date)).toBe('Feb 10, 2026');
  });

  it('formats different months correctly', () => {
    expect(formatAuditDate(new Date('2026-01-15T12:00:00'))).toBe('Jan 15, 2026');
    expect(formatAuditDate(new Date('2026-12-25T12:00:00'))).toBe('Dec 25, 2026');
  });

  it('handles single-digit days', () => {
    expect(formatAuditDate(new Date('2026-03-01T12:00:00'))).toBe('Mar 1, 2026');
  });

  it('handles leap year date', () => {
    expect(formatAuditDate(new Date('2024-02-29T12:00:00'))).toBe('Feb 29, 2024');
  });

  it('handles end of month', () => {
    expect(formatAuditDate(new Date('2026-01-31T12:00:00'))).toBe('Jan 31, 2026');
  });

  it('uses current date when no argument provided', () => {
    const result = formatAuditDate();
    // Should return a valid date string format
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  });
});
