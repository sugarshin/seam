import { describe, expect, it } from 'vitest';
import type { GarmentItem } from '@seam/shared';
import { suggestSimilarItems } from './suggestSimilarItems';

const item = (overrides: Partial<GarmentItem> = {}): GarmentItem => ({
  id: 'i',
  status: 'owned',
  name: 'name',
  category: 't_shirt',
  isFitAnchor: false,
  isSellCandidate: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('suggestSimilarItems', () => {
  const candidate = item({
    id: 'cand',
    status: 'wishlist',
    brand: 'Nike',
    color: 'black',
    category: 't_shirt',
    sizeLabel: 'L',
  });

  it('returns empty array when there are no owned items', () => {
    expect(suggestSimilarItems(candidate, [])).toEqual([]);
  });

  it('filters by same category by default', () => {
    const owned = [
      item({ id: 'a', category: 't_shirt' }),
      item({ id: 'b', category: 'denim_pants' }),
    ];
    expect(suggestSimilarItems(candidate, owned).map((i) => i.id)).toEqual(['a']);
  });

  it('filters by brand when sameBrand=true', () => {
    const owned = [
      item({ id: 'a', category: 't_shirt', brand: 'Nike' }),
      item({ id: 'b', category: 't_shirt', brand: 'Adidas' }),
    ];
    expect(suggestSimilarItems(candidate, owned, { sameBrand: true }).map((i) => i.id)).toEqual([
      'a',
    ]);
  });

  it('ranks items with more matching attributes higher', () => {
    const owned = [
      item({ id: 'low', category: 't_shirt', brand: 'Adidas', color: 'white' }),
      item({ id: 'high', category: 't_shirt', brand: 'Nike', color: 'black', sizeLabel: 'L' }),
      item({ id: 'mid', category: 't_shirt', brand: 'Nike', color: 'white' }),
    ];
    expect(suggestSimilarItems(candidate, owned).map((i) => i.id)).toEqual(['high', 'mid', 'low']);
  });

  it('respects limit option', () => {
    const owned = [
      item({ id: 'a', category: 't_shirt' }),
      item({ id: 'b', category: 't_shirt' }),
      item({ id: 'c', category: 't_shirt' }),
    ];
    expect(suggestSimilarItems(candidate, owned, { limit: 2 }).length).toBe(2);
  });

  it('does not include the candidate itself even if id collides', () => {
    const owned = [item({ id: 'cand', category: 't_shirt' }), item({ id: 'a' })];
    expect(suggestSimilarItems(candidate, owned).map((i) => i.id)).toEqual(['a']);
  });

  it('returns items across categories when sameCategory=false', () => {
    const owned = [
      item({ id: 'pants', category: 'denim_pants' }),
      item({ id: 'shirt', category: 't_shirt' }),
    ];
    const result = suggestSimilarItems(candidate, owned, { sameCategory: false });
    expect(result.map((i) => i.id).sort()).toEqual(['pants', 'shirt'].sort());
  });
});
