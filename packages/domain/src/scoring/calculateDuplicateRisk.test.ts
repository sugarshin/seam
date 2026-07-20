import { describe, expect, it } from 'vitest';
import type { GarmentItem } from '@seam/shared';
import { calculateDuplicateRisk } from './calculateDuplicateRisk';

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

describe('calculateDuplicateRisk', () => {
  const candidate = item({
    id: 'cand',
    status: 'wishlist',
    brand: 'Levi’s',
    color: 'indigo',
    category: 'denim_pants',
  });

  it('returns 0 when ownedItems is empty', () => {
    expect(calculateDuplicateRisk(candidate, [])).toBe(0);
  });

  it('returns 0 when no item shares the category', () => {
    const owned = [item({ id: '1', category: 't_shirt', brand: 'Levi’s', color: 'indigo' })];
    expect(calculateDuplicateRisk(candidate, owned)).toBe(0);
  });

  it('returns 5 for same category only', () => {
    const owned = [item({ id: '1', category: 'denim_pants', brand: 'Lee', color: 'black' })];
    expect(calculateDuplicateRisk(candidate, owned)).toBe(5);
  });

  it('returns 15 for same category + color', () => {
    const owned = [item({ id: '1', category: 'denim_pants', brand: 'Lee', color: 'indigo' })];
    expect(calculateDuplicateRisk(candidate, owned)).toBe(15);
  });

  it('returns 25 for same category + brand', () => {
    const owned = [item({ id: '1', category: 'denim_pants', brand: 'Levi’s', color: 'black' })];
    expect(calculateDuplicateRisk(candidate, owned)).toBe(25);
  });

  it('returns 40 for same category + brand + color', () => {
    const owned = [item({ id: '1', category: 'denim_pants', brand: 'Levi’s', color: 'indigo' })];
    expect(calculateDuplicateRisk(candidate, owned)).toBe(40);
  });

  it('uses the worst (highest) match across many owned items', () => {
    const owned = [
      item({ id: '1', category: 'denim_pants', brand: 'Lee', color: 'black' }), // 5
      item({ id: '2', category: 'denim_pants', brand: 'Lee', color: 'indigo' }), // 15
      item({ id: '3', category: 'denim_pants', brand: 'Levi’s', color: 'indigo' }), // 40
    ];
    expect(calculateDuplicateRisk(candidate, owned)).toBe(40);
  });

  it('compares case- and whitespace-insensitively', () => {
    const owned = [
      item({ id: '1', category: 'denim_pants', brand: '  LEVI’S ', color: 'INDIGO ' }),
    ];
    expect(calculateDuplicateRisk(candidate, owned)).toBe(40);
  });

  it('treats undefined brand/color as no-match (no false positives)', () => {
    const noBrandCandidate = item({
      id: 'c',
      category: 'denim_pants',
      brand: undefined,
      color: undefined,
      status: 'wishlist',
    });
    const owned = [item({ id: '1', category: 'denim_pants', brand: 'Levi’s', color: 'indigo' })];
    expect(calculateDuplicateRisk(noBrandCandidate, owned)).toBe(5);
  });

  it('skips the candidate itself when present in ownedItems', () => {
    const owned = [
      candidate, // self should not count even though it would be a perfect 40
      item({ id: '1', category: 'denim_pants', brand: 'Lee', color: 'black' }),
    ];
    expect(calculateDuplicateRisk(candidate, owned)).toBe(5);
  });
});
