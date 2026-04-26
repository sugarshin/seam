import type { GarmentItem } from '@seam/shared';

const MIN = 0;
const MAX = 100;

const clamp = (n: number): number => Math.max(MIN, Math.min(MAX, n));

const norm = (s: string | undefined): string | undefined =>
  s === undefined ? undefined : s.trim().toLowerCase();

/**
 * Heuristic 0-100 "how unique would this candidate be in my wardrobe" score.
 *
 * The base value is driven by how many same-category items we already own
 * (more = less unique). Then we subtract 5 for every same-brand item to
 * penalise wardrobes that are heavy on a single brand.
 *
 *   countSame  ∈ [0]      → base 100 (a totally new genre)
 *               [1, 2]    → base 80
 *               [3, 4]    → base 60
 *               [5, 6]    → base 40
 *               [7, ∞)    → base 20
 *
 *   final = clamp(base - sameBrandCount * 5)
 *
 * Empty owned list ⇒ 100.
 */
export const calculateUniquenessScore = (
  candidate: GarmentItem,
  ownedItems: readonly GarmentItem[],
): number => {
  if (ownedItems.length === 0) return 100;

  const cBrand = norm(candidate.brand);

  let countSameCategory = 0;
  let countSameBrand = 0;
  for (const owned of ownedItems) {
    if (owned.id === candidate.id) continue;
    if (owned.category === candidate.category) countSameCategory += 1;
    if (cBrand !== undefined && norm(owned.brand) === cBrand) countSameBrand += 1;
  }

  const base = baseFromCount(countSameCategory);
  return clamp(base - countSameBrand * 5);
};

const baseFromCount = (count: number): number => {
  if (count <= 0) return 100;
  if (count <= 2) return 80;
  if (count <= 4) return 60;
  if (count <= 6) return 40;
  return 20;
};
