import { describe, expect, it } from 'vitest';
import type { AnalyticsItem, AnalyticsMeasurement } from './types';
import { brandStats } from './brandStats';
import { measurementKeysForMajor, summarizeMeasurements } from './measurementStats';
import { sizeFeelByLabel } from './sizeFeel';

const item = (
  id: string,
  measurements: AnalyticsMeasurement[],
  overrides: Partial<AnalyticsItem> = {},
): AnalyticsItem => ({
  id,
  status: 'owned',
  name: id,
  category: 'sweatshirt',
  isFitAnchor: false,
  isSellCandidate: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  wearCount: 0,
  measurements,
  ...overrides,
});

const chest = (value: number, unit: 'cm' | 'inch' = 'cm'): AnalyticsMeasurement => ({
  key: 'chestWidth',
  value,
  unit,
});

describe('measurementKeysForMajor', () => {
  it('unions keys across categories without duplicates', () => {
    const keys = measurementKeysForMajor('outer');
    expect(keys).toContain('chestWidth');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no keys for the other group', () => {
    expect(measurementKeysForMajor('other')).toEqual([]);
  });
});

describe('summarizeMeasurements', () => {
  it('reports quartiles and the well-fitting range, converting inches', () => {
    const [s] = summarizeMeasurements(
      [
        item('a', [chest(50)], { fitRating: 'too_small' }),
        item('b', [chest(54)], { fitRating: 'just' }),
        item('c', [chest(56)], { isFitAnchor: true }),
        item('d', [chest(24, 'inch')], { fitRating: 'large' }),
        item('e', []),
      ],
      ['chestWidth', 'bodyLength'],
    );
    expect(s).toBeDefined();
    expect(s?.key).toBe('chestWidth');
    expect(s?.unit).toBe('cm');
    expect(s?.count).toBe(4);
    expect(s?.min).toBe(50);
    expect(s?.max).toBeCloseTo(60.96);
    expect(s?.median).toBe(55);
    expect(s?.p25).toBe(53);
    expect(s?.fit).toEqual({ count: 2, min: 54, median: 55, max: 56 });
  });

  it('omits keys nobody measured and returns null fit when nothing fits', () => {
    const out = summarizeMeasurements([item('a', [chest(50)])], ['bodyLength', 'chestWidth']);
    expect(out.map((s) => s.key)).toEqual(['chestWidth']);
    expect(out[0]?.fit).toBeNull();
  });

  it('keeps only the dominant shoe-size unit', () => {
    const shoes = (value: number, unit: 'jp' | 'us'): AnalyticsMeasurement => ({
      key: 'jpSize',
      value,
      unit,
    });
    const [s] = summarizeMeasurements(
      [
        item('a', [shoes(27, 'jp')], { category: 'sneakers' }),
        item('b', [shoes(27.5, 'jp')], { category: 'sneakers' }),
        item('c', [shoes(9, 'us')], { category: 'sneakers' }),
      ],
      ['jpSize'],
    );
    expect(s?.unit).toBe('jp');
    expect(s?.count).toBe(2);
  });
});

describe('sizeFeelByLabel', () => {
  it('groups by size label and compares brand medians', () => {
    const feel = sizeFeelByLabel(
      [
        item('a', [chest(54)], { brand: 'Champion', sizeLabel: 'L' }),
        item('b', [chest(56)], { brand: 'champion', sizeLabel: 'l' }),
        item('c', [chest(60)], { brand: 'Russell', sizeLabel: 'L' }),
        item('d', [chest(50)], { brand: 'Russell', sizeLabel: 'M' }),
        item('e', [chest(70)], { sizeLabel: 'L' }),
        item('f', [], { brand: 'Russell', sizeLabel: 'XL' }),
      ],
      'chestWidth',
    );
    expect(feel.unit).toBe('cm');
    expect(feel.groups.map((g) => g.sizeLabel)).toEqual(['M', 'L']);
    const l = feel.groups[1];
    expect(l?.brands.map((b) => [b.brand, b.count, b.median])).toEqual([
      ['Champion', 2, 55],
      ['Russell', 1, 60],
    ]);
    expect(l?.spread).toBe(5);
    expect(feel.groups[0]?.spread).toBeNull();
  });
});

describe('brandStats', () => {
  it('merges spelling variants and aggregates per brand', () => {
    const stats = brandStats([
      item('a', [], { brand: "Levi's", totalPrice: 8000, wearCount: 4, favoriteScore: 5 }),
      item('b', [], { brand: 'LEVI’S', totalPrice: 4000, wearCount: 0 }),
      item('c', [], { brand: 'Lee', totalPrice: 3000, wearCount: 1, favoriteScore: 3 }),
      item('d', [], {}),
    ]);
    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({
      label: "Levi's",
      count: 2,
      totalAmount: 12000,
      averagePrice: 6000,
      averageWears: 2,
      averageFavorite: 5,
    });
    expect(stats[1]?.label).toBe('Lee');
  });
});
