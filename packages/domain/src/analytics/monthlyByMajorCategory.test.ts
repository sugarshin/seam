import { describe, expect, it } from 'vitest';
import type { GarmentItem } from '@seam/shared';
import { monthlyByMajorCategory } from './monthlyByMajorCategory';
import { summarizeSales } from './summarizeSales';
import type { SoldAnalyticsItem } from './types';

const item = (overrides: Partial<SoldAnalyticsItem>): SoldAnalyticsItem => ({
  id: 'i',
  status: 'owned',
  name: 'item',
  category: 't_shirt',
  isFitAnchor: false,
  isSellCandidate: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('monthlyByMajorCategory', () => {
  const now = new Date(2026, 9, 25); // 2026-10-25 local

  it('pads empty months oldest-first and splits by major category', () => {
    const items: GarmentItem[] = [
      item({ category: 'coat', totalPrice: 20000, purchaseDate: '2026-10-01' }),
      item({ category: 't_shirt', purchasePrice: 3000, purchaseDate: '2026-10-20' }),
      item({ category: 'denim_pants', totalPrice: 9000, purchaseDate: '2026-08-31' }),
      item({ category: 'coat', totalPrice: 1, purchaseDate: '2025-01-01' }),
      item({ category: 'coat', totalPrice: 1 }),
    ];
    const buckets = monthlyByMajorCategory(items, now, 3);
    expect(buckets.map((b) => b.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(buckets[0]).toMatchObject({ count: 1, amount: 9000 });
    expect(buckets[0]?.byMajor.bottoms).toEqual({ count: 1, amount: 9000 });
    expect(buckets[1]).toMatchObject({ count: 0, amount: 0 });
    expect(buckets[2]).toMatchObject({ count: 2, amount: 23000 });
    expect(buckets[2]?.byMajor.outer).toEqual({ count: 1, amount: 20000 });
    expect(buckets[2]?.byMajor.inner).toEqual({ count: 1, amount: 3000 });
  });

  it('reads date-only strings without timezone shifts', () => {
    const buckets = monthlyByMajorCategory(
      [item({ totalPrice: 1000, purchaseDate: '2026-09-01' })],
      now,
      2,
    );
    expect(buckets[0]).toMatchObject({ month: '2026-09', count: 1 });
  });
});

describe('summarizeSales', () => {
  it('totals only items with both cost and sold price', () => {
    const s = summarizeSales([
      item({ status: 'sold', totalPrice: 10000, soldPrice: 7000 }),
      item({ status: 'sold', purchasePrice: 3000, soldPrice: 4500 }),
      item({ status: 'sold', totalPrice: 5000 }),
    ]);
    expect(s).toEqual({
      count: 3,
      pricedCount: 2,
      totalCost: 13000,
      totalProceeds: 11500,
      profit: -1500,
      recoveryRate: 11500 / 13000,
    });
  });

  it('returns a null recovery rate without cost', () => {
    expect(summarizeSales([]).recoveryRate).toBeNull();
  });
});
