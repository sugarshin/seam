/**
 * Pure helpers used by `aggregateStats`.
 * Kept side-effect free so they can be unit-tested without DB access.
 */
import type { GarmentItem, GarmentCategory, DecisionKind } from '@seam/shared';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Format an ISO date string (or a `Date`) as `YYYY-MM`.
 * Returns null when the input is missing or unparseable.
 */
export const toYearMonth = (input: string | Date | undefined | null): string | null => {
  if (input === undefined || input === null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
};

/**
 * Build a list of the last `count` `YYYY-MM` strings, oldest → newest, ending at `now`.
 * Useful for filling sparse monthly buckets so charts don't have gaps.
 */
export const lastNMonths = (now: Date, count: number): string[] => {
  const out: string[] = [];
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

/**
 * Days elapsed from `from` to `to`, floored. Negative values clamped to 0.
 * Returns null when `from` is unparseable.
 */
export const daysSince = (from: string | undefined | null, to: Date): number | null => {
  if (from === undefined || from === null || from === '') return null;
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.floor((to.getTime() - d.getTime()) / MS_PER_DAY);
  return diff < 0 ? 0 : diff;
};

/**
 * Group items by the (category, brand, color) tuple and return clusters where
 * size >= 2. brand/color are normalized: undefined / empty → '__unknown__'
 * is excluded (we don't cluster purely by missing-brand or missing-color
 * because that produces noise like "12 items with no brand").
 *
 * Items must have at least a brand OR a color to participate; clusters
 * therefore have a meaningful definition of "duplicate".
 */
export type DuplicateCluster = {
  category: GarmentCategory;
  brand?: string;
  color?: string;
  itemIds: string[];
};

export const findDuplicateClusters = (items: readonly GarmentItem[]): DuplicateCluster[] => {
  const groups = new Map<
    string,
    { category: GarmentCategory; brand?: string; color?: string; itemIds: string[] }
  >();
  for (const it of items) {
    const brand = it.brand?.trim();
    const color = it.color?.trim();
    // Require at least one discriminator alongside category, otherwise skip.
    if (!brand && !color) continue;
    const key = `${it.category}::${brand ?? ''}::${color ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.itemIds.push(it.id);
    } else {
      groups.set(key, {
        category: it.category,
        brand: brand || undefined,
        color: color || undefined,
        itemIds: [it.id],
      });
    }
  }
  const clusters: DuplicateCluster[] = [];
  for (const g of groups.values()) {
    if (g.itemIds.length >= 2) clusters.push(g);
  }
  // Largest clusters first; stable order on ties via the first item id.
  clusters.sort((a, b) => {
    if (b.itemIds.length !== a.itemIds.length) return b.itemIds.length - a.itemIds.length;
    return (a.itemIds[0] ?? '').localeCompare(b.itemIds[0] ?? '');
  });
  return clusters;
};

/**
 * Count items by a string-valued accessor and return the top `n` entries
 * (descending). Empty / undefined keys are ignored. Used for brand/color
 * top-10 lists.
 */
export const topNCounts = <T>(
  items: readonly T[],
  pick: (item: T) => string | undefined | null,
  n: number,
): { key: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const it of items) {
    const raw = pick(it);
    const key = raw?.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const arr = Array.from(counts, ([key, count]) => ({ key, count }));
  arr.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.key.localeCompare(b.key);
  });
  return arr.slice(0, n);
};

/**
 * Compute monthly purchase buckets for `items`, padded to the last `months` months
 * ending at `now`. Items without a `purchaseDate` are ignored. Amount uses
 * `totalPrice ?? purchasePrice ?? 0`.
 */
export const monthlyPurchaseBuckets = (
  items: readonly GarmentItem[],
  now: Date,
  months: number,
): { month: string; count: number; amount: number }[] => {
  const buckets = new Map<string, { count: number; amount: number }>();
  for (const m of lastNMonths(now, months)) {
    buckets.set(m, { count: 0, amount: 0 });
  }
  for (const it of items) {
    const ym = toYearMonth(it.purchaseDate);
    if (!ym) continue;
    const bucket = buckets.get(ym);
    if (!bucket) continue; // outside the window
    bucket.count += 1;
    bucket.amount += it.totalPrice ?? it.purchasePrice ?? 0;
  }
  return Array.from(buckets, ([month, b]) => ({ month, count: b.count, amount: b.amount }));
};

/**
 * Average purchase price across `items`, using `totalPrice` and falling
 * back to `purchasePrice`. Items contributing 0 (no price recorded) are
 * still counted in the denominator only when at least one of the price
 * fields is set.
 */
export const averagePurchasePrice = (items: readonly GarmentItem[]): number => {
  let sum = 0;
  let count = 0;
  for (const it of items) {
    const price = it.totalPrice ?? it.purchasePrice;
    if (price === undefined) continue;
    sum += price;
    count += 1;
  }
  return count === 0 ? 0 : Math.round(sum / count);
};

/**
 * Convert absolute decision counts into a {0..1} ratio map.
 * If the total is zero, every key gets 0.
 */
export const toDecisionRatio = (
  counts: Record<DecisionKind, number>,
): Record<DecisionKind, number> => {
  const total = counts.buy + counts.watch + counts.skip + counts.lost_auction;
  if (total === 0) {
    return { buy: 0, watch: 0, skip: 0, lost_auction: 0 };
  }
  return {
    buy: counts.buy / total,
    watch: counts.watch / total,
    skip: counts.skip / total,
    lost_auction: counts.lost_auction / total,
  };
};
