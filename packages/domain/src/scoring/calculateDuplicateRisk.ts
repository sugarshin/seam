import type { GarmentItem } from '@seam/shared';

const MIN = 0;
const MAX = 100;

const clamp = (n: number): number => Math.max(MIN, Math.min(MAX, n));

const norm = (s: string | undefined): string | undefined =>
  s === undefined ? undefined : s.trim().toLowerCase();

const eq = (a: string | undefined, b: string | undefined): boolean =>
  a !== undefined && b !== undefined && a === b;

/**
 * Heuristic 0-100 score for "how likely is this candidate a duplicate of
 * something I already own".
 *
 * Strategy
 * ────────
 * - For each owned item we measure overlap with the candidate on
 *   category / brand / color and assign a per-pair score.
 * - The candidate's risk is the *worst* (highest) per-pair score — a single
 *   strong duplicate dominates many weak overlaps.
 * - Empty owned list ⇒ 0 (nothing to duplicate).
 *
 * Scoring per pair
 *   same category + same brand + same color → 40
 *   same category + same brand              → 25
 *   same category + same color              → 15
 *   same category only                      → 5
 *   no category match                       → 0
 */
export const calculateDuplicateRisk = (
  candidate: GarmentItem,
  ownedItems: readonly GarmentItem[],
): number => {
  if (ownedItems.length === 0) return 0;

  const cCat = candidate.category;
  const cBrand = norm(candidate.brand);
  const cColor = norm(candidate.color);

  let best = 0;
  for (const owned of ownedItems) {
    if (owned.id === candidate.id) continue;
    if (owned.category !== cCat) continue;

    const oBrand = norm(owned.brand);
    const oColor = norm(owned.color);

    let pair = 5; // same category only
    const brandMatch = eq(cBrand, oBrand);
    const colorMatch = eq(cColor, oColor);
    if (brandMatch && colorMatch) pair = 40;
    else if (brandMatch) pair = 25;
    else if (colorMatch) pair = 15;

    if (pair > best) best = pair;
    if (best >= MAX) break;
  }

  return clamp(best);
};
