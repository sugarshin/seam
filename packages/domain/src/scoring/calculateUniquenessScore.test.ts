import { describe, expect, it } from 'vitest';
import type { GarmentItem } from '@seam/shared';
import { calculateUniquenessScore } from './calculateUniquenessScore';

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

const make = (n: number, partial: Partial<GarmentItem>): GarmentItem[] =>
  Array.from({ length: n }, (_, i) => item({ id: `o${i}`, ...partial }));

describe('calculateUniquenessScore', () => {
  const candidate = item({
    id: 'cand',
    status: 'wishlist',
    category: 'pants',
    brand: 'Levi’s',
  });

  it('returns 100 when ownedItems is empty', () => {
    expect(calculateUniquenessScore(candidate, [])).toBe(100);
  });

  it('returns 100 when no owned item shares the category', () => {
    const owned = [item({ id: '1', category: 't_shirt' }), item({ id: '2', category: 'jacket' })];
    expect(calculateUniquenessScore(candidate, owned)).toBe(100);
  });

  it('returns 80 for 1 same-category, no brand overlap', () => {
    const owned = [item({ id: '1', category: 'pants', brand: 'Lee' })];
    expect(calculateUniquenessScore(candidate, owned)).toBe(80);
  });

  it('returns 80 for 2 same-category items', () => {
    const owned = make(2, { category: 'pants', brand: 'Lee' });
    expect(calculateUniquenessScore(candidate, owned)).toBe(80);
  });

  it('returns 60 for 3-4 same-category items', () => {
    const owned3 = make(3, { category: 'pants', brand: 'Lee' });
    const owned4 = make(4, { category: 'pants', brand: 'Lee' });
    expect(calculateUniquenessScore(candidate, owned3)).toBe(60);
    expect(calculateUniquenessScore(candidate, owned4)).toBe(60);
  });

  it('returns 40 for 5-6 same-category items', () => {
    expect(calculateUniquenessScore(candidate, make(5, { category: 'pants', brand: 'Lee' }))).toBe(
      40,
    );
    expect(calculateUniquenessScore(candidate, make(6, { category: 'pants', brand: 'Lee' }))).toBe(
      40,
    );
  });

  it('returns 20 for 7+ same-category items', () => {
    expect(calculateUniquenessScore(candidate, make(7, { category: 'pants', brand: 'Lee' }))).toBe(
      20,
    );
  });

  it('subtracts 5 per same-brand item', () => {
    // 1 jeans (base 80), all also same brand → 80 - 1*5 = 75
    const owned = [item({ id: '1', category: 'pants', brand: 'Levi’s' })];
    expect(calculateUniquenessScore(candidate, owned)).toBe(75);
  });

  it('clamps at 0 when many same-brand items dominate', () => {
    const owned = make(20, { category: 'pants', brand: 'Levi’s' });
    expect(calculateUniquenessScore(candidate, owned)).toBe(0);
  });

  it('treats undefined candidate brand as no brand penalty', () => {
    const c = item({ id: 'c2', status: 'wishlist', category: 'pants', brand: undefined });
    const owned = make(1, { category: 'pants', brand: 'Levi’s' });
    expect(calculateUniquenessScore(c, owned)).toBe(80);
  });

  it('skips the candidate itself if present in ownedItems', () => {
    const owned = [candidate];
    expect(calculateUniquenessScore(candidate, owned)).toBe(100);
  });
});
