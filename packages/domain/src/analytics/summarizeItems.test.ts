import { describe, expect, it } from 'vitest';
import type { AnalyticsItem } from './types';
import { summarizeItems } from './summarizeItems';
import { rankByWears } from './rankByWears';

const item = (overrides: Partial<AnalyticsItem>): AnalyticsItem => ({
  id: 'i',
  status: 'owned',
  name: 'item',
  category: 't_shirt',
  isFitAnchor: false,
  isSellCandidate: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  wearCount: 0,
  measurements: [],
  ...overrides,
});

describe('summarizeItems', () => {
  it('returns nulls for an empty list', () => {
    const s = summarizeItems([]);
    expect(s.count).toBe(0);
    expect(s.averagePrice).toBeNull();
    expect(s.medianPrice).toBeNull();
    expect(s.averageWears).toBeNull();
    expect(s.unwornRate).toBeNull();
    expect(s.costPerWear).toBeNull();
    expect(s.justFitRate).toBeNull();
  });

  it('computes price stats over priced items only, preferring totalPrice', () => {
    const s = summarizeItems([
      item({ id: 'a', totalPrice: 3000, purchasePrice: 2500 }),
      item({ id: 'b', purchasePrice: 5000 }),
      item({ id: 'c', totalPrice: 10000 }),
      item({ id: 'd' }),
    ]);
    expect(s.count).toBe(4);
    expect(s.pricedCount).toBe(3);
    expect(s.totalAmount).toBe(18000);
    expect(s.averagePrice).toBe(6000);
    expect(s.medianPrice).toBe(5000);
  });

  it('computes wear, unworn and cost-per-wear', () => {
    const s = summarizeItems([
      item({ id: 'a', totalPrice: 6000, wearCount: 3 }),
      item({ id: 'b', totalPrice: 4000, wearCount: 0 }),
      item({ id: 'c', wearCount: 5 }),
    ]);
    expect(s.totalWears).toBe(8);
    expect(s.averageWears).toBeCloseTo(8 / 3);
    expect(s.unwornCount).toBe(1);
    expect(s.unwornRate).toBeCloseTo(1 / 3);
    // (6000 + 4000) / (3 + 0): unpriced item c's wears are excluded.
    expect(s.costPerWear).toBeCloseTo(10000 / 3);
  });

  it('averages favorites and the just-fit share among rated items', () => {
    const s = summarizeItems([
      item({ id: 'a', favoriteScore: 5, fitRating: 'just' }),
      item({ id: 'b', favoriteScore: 3, fitRating: 'large' }),
      item({ id: 'c' }),
    ]);
    expect(s.averageFavorite).toBe(4);
    expect(s.fitRatedCount).toBe(2);
    expect(s.justFitRate).toBe(0.5);
  });
});

describe('rankByWears', () => {
  it('sorts by wear count desc, drops unworn, and limits', () => {
    const ranked = rankByWears(
      [
        item({ id: 'a', name: 'A', wearCount: 2 }),
        item({ id: 'b', name: 'B', wearCount: 0 }),
        item({ id: 'c', name: 'C', wearCount: 9 }),
        item({ id: 'd', name: 'D', wearCount: 2 }),
      ],
      2,
    );
    expect(ranked.map((r) => r.id)).toEqual(['c', 'a']);
  });
});
