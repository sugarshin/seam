import { describe, expect, it } from 'vitest';
import type { GarmentItem } from '@seam/shared';
import {
  averagePurchasePrice,
  daysSince,
  findDuplicateClusters,
  lastNMonths,
  monthlyPurchaseBuckets,
  toDecisionRatio,
  topNCounts,
  toYearMonth,
} from './aggregators';

const baseItem = (overrides: Partial<GarmentItem>): GarmentItem =>
  ({
    id: 'i',
    status: 'owned',
    name: 'name',
    category: 'shirt',
    isFitAnchor: false,
    isSellCandidate: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as GarmentItem;

describe('toYearMonth', () => {
  it('parses ISO strings', () => {
    expect(toYearMonth('2026-04-26T00:00:00.000Z')).toBe('2026-04');
  });
  it('parses YYYY-MM-DD', () => {
    expect(toYearMonth('2025-12-15')).toBe('2025-12');
  });
  it('returns null for missing / invalid', () => {
    expect(toYearMonth(undefined)).toBeNull();
    expect(toYearMonth('')).toBeNull();
    expect(toYearMonth('not-a-date')).toBeNull();
  });
});

describe('lastNMonths', () => {
  it('lists 12 months ending at now, oldest first', () => {
    const now = new Date(2026, 3, 26); // local time, April
    const months = lastNMonths(now, 12);
    expect(months).toHaveLength(12);
    expect(months[months.length - 1]).toBe('2026-04');
    expect(months[0]).toBe('2025-05');
  });
  it('handles year boundary', () => {
    const now = new Date(2026, 1, 1); // Feb 2026
    const months = lastNMonths(now, 3);
    expect(months).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('daysSince', () => {
  it('returns whole days', () => {
    const to = new Date('2026-04-26T00:00:00.000Z');
    expect(daysSince('2026-04-20T00:00:00.000Z', to)).toBe(6);
  });
  it('clamps negative diffs to 0', () => {
    const to = new Date('2026-04-26T00:00:00.000Z');
    expect(daysSince('2026-05-01T00:00:00.000Z', to)).toBe(0);
  });
  it('returns null for missing', () => {
    expect(daysSince(undefined, new Date())).toBeNull();
  });
});

describe('findDuplicateClusters', () => {
  it('groups items sharing category+brand+color', () => {
    const items = [
      baseItem({ id: 'a', category: 'shirt', brand: 'X', color: 'black' }),
      baseItem({ id: 'b', category: 'shirt', brand: 'X', color: 'black' }),
      baseItem({ id: 'c', category: 'shirt', brand: 'Y', color: 'black' }),
    ];
    const clusters = findDuplicateClusters(items);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.itemIds.sort()).toEqual(['a', 'b']);
  });

  it('skips items missing both brand and color', () => {
    const items = [
      baseItem({ id: 'a', category: 'shirt' }),
      baseItem({ id: 'b', category: 'shirt' }),
    ];
    expect(findDuplicateClusters(items)).toHaveLength(0);
  });

  it('groups by brand only when color is missing', () => {
    const items = [
      baseItem({ id: 'a', category: 'shirt', brand: 'X' }),
      baseItem({ id: 'b', category: 'shirt', brand: 'X' }),
    ];
    const clusters = findDuplicateClusters(items);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.brand).toBe('X');
    expect(clusters[0]?.color).toBeUndefined();
  });

  it('returns largest clusters first', () => {
    const items = [
      baseItem({ id: 'a1', category: 'shirt', brand: 'A', color: 'red' }),
      baseItem({ id: 'a2', category: 'shirt', brand: 'A', color: 'red' }),
      baseItem({ id: 'b1', category: 'pants', brand: 'B', color: 'blue' }),
      baseItem({ id: 'b2', category: 'pants', brand: 'B', color: 'blue' }),
      baseItem({ id: 'b3', category: 'pants', brand: 'B', color: 'blue' }),
    ];
    const clusters = findDuplicateClusters(items);
    expect(clusters[0]?.itemIds).toHaveLength(3);
    expect(clusters[1]?.itemIds).toHaveLength(2);
  });

  it('treats whitespace-only brand as missing', () => {
    const items = [
      baseItem({ id: 'a', category: 'shirt', brand: '   ', color: 'red' }),
      baseItem({ id: 'b', category: 'shirt', brand: '', color: 'red' }),
    ];
    const clusters = findDuplicateClusters(items);
    // brand normalized away, color shared → still clusters
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.brand).toBeUndefined();
    expect(clusters[0]?.color).toBe('red');
  });
});

describe('topNCounts', () => {
  it('counts and sorts descending, then alphabetically on ties', () => {
    const items = [
      { brand: 'Apple' },
      { brand: 'Apple' },
      { brand: 'Banana' },
      { brand: 'Cherry' },
      { brand: 'Cherry' },
    ];
    const top = topNCounts(items, (i) => i.brand, 5);
    expect(top.map((t) => t.key)).toEqual(['Apple', 'Cherry', 'Banana']);
  });
  it('ignores empty / undefined keys', () => {
    const items = [{ b: undefined }, { b: '' }, { b: '   ' }, { b: 'X' }];
    const top = topNCounts(items, (i) => i.b, 5);
    expect(top).toEqual([{ key: 'X', count: 1 }]);
  });
  it('respects n', () => {
    const items = [{ k: 'a' }, { k: 'b' }, { k: 'c' }];
    expect(topNCounts(items, (i) => i.k, 2)).toHaveLength(2);
  });
});

describe('monthlyPurchaseBuckets', () => {
  it('pads to the requested window with zero values', () => {
    const now = new Date(2026, 3, 26);
    const buckets = monthlyPurchaseBuckets([], now, 3);
    expect(buckets).toEqual([
      { month: '2026-02', count: 0, amount: 0 },
      { month: '2026-03', count: 0, amount: 0 },
      { month: '2026-04', count: 0, amount: 0 },
    ]);
  });

  it('sums amounts using totalPrice with fallback to purchasePrice', () => {
    const now = new Date(2026, 3, 26);
    const items = [
      baseItem({ id: '1', purchaseDate: '2026-04-10', totalPrice: 1000 }),
      baseItem({ id: '2', purchaseDate: '2026-04-20', purchasePrice: 500 }),
      baseItem({ id: '3', purchaseDate: '2026-03-01', totalPrice: 2000 }),
    ];
    const buckets = monthlyPurchaseBuckets(items, now, 3);
    const apr = buckets.find((b) => b.month === '2026-04');
    expect(apr).toEqual({ month: '2026-04', count: 2, amount: 1500 });
    const mar = buckets.find((b) => b.month === '2026-03');
    expect(mar).toEqual({ month: '2026-03', count: 1, amount: 2000 });
  });

  it('ignores items outside the window', () => {
    const now = new Date(2026, 3, 26);
    const items = [
      baseItem({ id: 'old', purchaseDate: '2024-01-01', totalPrice: 9999 }),
    ];
    const buckets = monthlyPurchaseBuckets(items, now, 3);
    expect(buckets.every((b) => b.amount === 0)).toBe(true);
  });
});

describe('averagePurchasePrice', () => {
  it('computes mean across items with prices', () => {
    const items = [
      baseItem({ id: '1', totalPrice: 1000 }),
      baseItem({ id: '2', purchasePrice: 2000 }),
      baseItem({ id: '3' }),
    ];
    expect(averagePurchasePrice(items)).toBe(1500);
  });
  it('returns 0 when no items', () => {
    expect(averagePurchasePrice([])).toBe(0);
  });
});

describe('toDecisionRatio', () => {
  it('converts counts to fractions', () => {
    const r = toDecisionRatio({ buy: 1, watch: 1, skip: 2, lost_auction: 0 });
    expect(r.buy).toBeCloseTo(0.25);
    expect(r.skip).toBeCloseTo(0.5);
  });
  it('handles all-zero', () => {
    expect(toDecisionRatio({ buy: 0, watch: 0, skip: 0, lost_auction: 0 })).toEqual({
      buy: 0,
      watch: 0,
      skip: 0,
      lost_auction: 0,
    });
  });
});
