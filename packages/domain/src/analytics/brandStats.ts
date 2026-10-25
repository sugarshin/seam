import { mean } from './numeric';
import { nameKey } from './text';
import { type AnalyticsItem, priceOf } from './types';

export type BrandStat = {
  /** Normalized grouping key. */
  key: string;
  /** Spelling of the first item seen for this brand. */
  label: string;
  count: number;
  totalAmount: number;
  averagePrice: number | null;
  averageWears: number;
  averageFavorite: number | null;
};

/**
 * Per-brand count / spend / wear / favorite, sorted by count desc then spend
 * desc. Brands are grouped case- and width-insensitively.
 */
export const brandStats = (items: readonly AnalyticsItem[]): BrandStat[] => {
  const groups = new Map<string, { label: string; items: AnalyticsItem[] }>();
  for (const it of items) {
    const key = nameKey(it.brand);
    if (key === null) continue;
    const g = groups.get(key);
    if (g) g.items.push(it);
    else groups.set(key, { label: (it.brand ?? '').trim(), items: [it] });
  }

  const stats: BrandStat[] = [];
  for (const [key, g] of groups) {
    const prices = g.items.map(priceOf).filter((p): p is number => p !== undefined);
    const favorites = g.items
      .map((it) => it.favoriteScore)
      .filter((f): f is NonNullable<typeof f> => f !== undefined);
    stats.push({
      key,
      label: g.label,
      count: g.items.length,
      totalAmount: prices.reduce((a, b) => a + b, 0),
      averagePrice: mean(prices),
      averageWears: g.items.reduce((a, it) => a + it.wearCount, 0) / g.items.length,
      averageFavorite: mean(favorites),
    });
  }
  stats.sort(
    (a, b) => b.count - a.count || b.totalAmount - a.totalAmount || a.label.localeCompare(b.label),
  );
  return stats;
};
