import { describe, expect, it } from 'vitest';
import type { Measurement } from '@seam/shared';
import { compareMeasurements } from './compareMeasurements';

const m = (
  itemId: string,
  k: Measurement['key'],
  v: number,
  u: Measurement['unit'] = 'cm',
): Measurement => ({ id: `${itemId}-${k}`, itemId, key: k, value: v, unit: u });

describe('compareMeasurements', () => {
  it('returns empty array when both sides are empty', () => {
    expect(compareMeasurements([], [], 't_shirt')).toEqual([]);
  });

  it('skips keys missing on either side', () => {
    const candidate = [m('c', 'shoulderWidth', 50)];
    const reference = [m('r', 'chestWidth', 52)];
    expect(compareMeasurements(candidate, reference, 't_shirt')).toEqual([]);
  });

  it('computes diff in cm for matching keys', () => {
    const candidate = [m('c', 'shoulderWidth', 52), m('c', 'chestWidth', 56)];
    const reference = [m('r', 'shoulderWidth', 50), m('r', 'chestWidth', 54)];
    const diffs = compareMeasurements(candidate, reference, 't_shirt');
    expect(diffs).toHaveLength(2);
    const s = diffs.find((d) => d.key === 'shoulderWidth');
    expect(s).toBeDefined();
    expect(s?.diffCm).toBe(2);
    expect(s?.diffPct).toBeCloseTo(2 / 50, 5);
    expect(s?.comparable).toBe(true);
  });

  it('normalises inch to cm for comparison', () => {
    const candidate = [m('c', 'chestWidth', 20, 'inch')]; // ≈ 50.8 cm
    const reference = [m('r', 'chestWidth', 50, 'cm')];
    const diffs = compareMeasurements(candidate, reference, 't_shirt');
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.comparable).toBe(true);
    expect(diffs[0]?.diffCm).toBeCloseTo(0.8, 5);
  });

  it('marks shoes sizes with mismatched units as not comparable', () => {
    const candidate = [m('c', 'jpSize', 27, 'jp')];
    const reference = [m('r', 'usSize', 9, 'us')];
    // shoes category measurement keys include both jp and us, but they only
    // appear once each so neither pair has a matching key. Construct a case
    // where the *same* key has two different units instead.
    const candidate2 = [m('c', 'jpSize', 27, 'jp')];
    const reference2: Measurement[] = [
      { id: 'r-jpSize', itemId: 'r', key: 'jpSize', value: 27, unit: 'us' },
    ];
    expect(compareMeasurements(candidate, reference, 'shoes')).toEqual([]);
    const diffs = compareMeasurements(candidate2, reference2, 'shoes');
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.comparable).toBe(false);
    expect(diffs[0]?.diffCm).toBe(0);
  });

  it('returns 0% for reference value of 0', () => {
    const diffs = compareMeasurements(
      [m('c', 'inseam', 5)],
      [m('r', 'inseam', 0)],
      'pants',
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.diffPct).toBe(0);
  });

  it('only considers keys in the category group', () => {
    const candidate = [m('c', 'waist', 80), m('c', 'shoulderWidth', 50)];
    const reference = [m('r', 'waist', 78), m('r', 'shoulderWidth', 48)];
    const diffs = compareMeasurements(candidate, reference, 'pants');
    expect(diffs.map((d) => d.key)).toEqual(['waist']);
  });
});
