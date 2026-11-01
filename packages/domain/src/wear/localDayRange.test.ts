import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDayRange } from './localDayRange';

const isInRange = (iso: string, range: { from: string; to: string }): boolean =>
  iso >= range.from && iso < range.to;

describe('localDayRange', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Asia/Tokyo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the local midnight bounds in UTC', () => {
    expect(localDayRange(new Date(2026, 10, 1, 15, 30))).toEqual({
      from: '2026-10-31T15:00:00.000Z',
      to: '2026-11-01T15:00:00.000Z',
    });
  });

  it('includes the whole local day and excludes its neighbors', () => {
    const range = localDayRange(new Date(2026, 10, 1, 12));
    expect(isInRange(new Date(2026, 10, 1, 0, 0).toISOString(), range)).toBe(true);
    expect(isInRange(new Date(2026, 10, 1, 23, 59, 59, 999).toISOString(), range)).toBe(true);
    expect(isInRange(new Date(2026, 9, 31, 23, 59, 59, 999).toISOString(), range)).toBe(false);
    expect(isInRange(new Date(2026, 10, 2, 0, 0).toISOString(), range)).toBe(false);
  });

  it('includes a log saved from a YYYY-MM-DD date input for the same day', () => {
    const range = localDayRange(new Date(2026, 10, 1, 12));
    expect(isInRange(new Date('2026-11-01').toISOString(), range)).toBe(true);
    expect(isInRange(new Date('2026-10-31').toISOString(), range)).toBe(false);
  });

  it('rolls over month and year boundaries', () => {
    expect(localDayRange(new Date(2026, 11, 31, 12))).toEqual({
      from: '2026-12-30T15:00:00.000Z',
      to: '2026-12-31T15:00:00.000Z',
    });
  });
});
