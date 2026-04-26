import type { GarmentItem } from '@seam/shared';

export type SuggestSimilarItemsOptions = {
  /** Restrict to items with the same brand. Default: false. */
  sameBrand?: boolean;
  /** Restrict to items with the same category. Default: true. */
  sameCategory?: boolean;
  /** Maximum number of items to return. Default: 5. */
  limit?: number;
};

const DEFAULTS: Required<SuggestSimilarItemsOptions> = {
  sameBrand: false,
  sameCategory: true,
  limit: 5,
};

/**
 * Lightweight similarity ranker. Filters first (category / brand) and then
 * scores by attribute overlap with the candidate.
 *
 * Scoring (higher is more similar):
 *  - same brand               +30
 *  - same category            +20
 *  - same color               +10
 *  - same sizeLabel           +5
 *
 * Owned items rank ahead of other candidates when ties occur (prefer
 * comparing against things already in the closet).
 */
export const suggestSimilarItems = (
  candidate: GarmentItem,
  ownedItems: readonly GarmentItem[],
  options: SuggestSimilarItemsOptions = {},
): GarmentItem[] => {
  const opts = { ...DEFAULTS, ...options };

  const filtered = ownedItems.filter((it) => {
    if (it.id === candidate.id) return false;
    if (opts.sameCategory && it.category !== candidate.category) return false;
    if (opts.sameBrand && (it.brand ?? '').toLowerCase() !== (candidate.brand ?? '').toLowerCase()) {
      return false;
    }
    return true;
  });

  const scored = filtered.map((it) => {
    let score = 0;
    if (it.brand && candidate.brand && it.brand.toLowerCase() === candidate.brand.toLowerCase()) {
      score += 30;
    }
    if (it.category === candidate.category) {
      score += 20;
    }
    if (it.color && candidate.color && it.color.toLowerCase() === candidate.color.toLowerCase()) {
      score += 10;
    }
    if (it.sizeLabel && candidate.sizeLabel && it.sizeLabel === candidate.sizeLabel) {
      score += 5;
    }
    if (it.status === 'owned') score += 1;
    return { item: it, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.item.createdAt.localeCompare(a.item.createdAt);
  });

  return scored.slice(0, opts.limit).map((s) => s.item);
};
