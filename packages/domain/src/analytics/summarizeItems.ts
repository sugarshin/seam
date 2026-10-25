import { mean, median } from './numeric';
import { type AnalyticsItem, priceOf } from './types';

export type ItemsSummary = {
  count: number;
  /** Items with a recorded price. Amount / price stats only consider these. */
  pricedCount: number;
  totalAmount: number;
  averagePrice: number | null;
  medianPrice: number | null;
  totalWears: number;
  averageWears: number | null;
  unwornCount: number;
  unwornRate: number | null;
  /** Total amount of priced items / their total wears. null until something is worn. */
  costPerWear: number | null;
  averageFavorite: number | null;
  /** Items with a fit rating. */
  fitRatedCount: number;
  /** Share of fit-rated items rated "just". */
  justFitRate: number | null;
};

export const summarizeItems = (items: readonly AnalyticsItem[]): ItemsSummary => {
  const prices: number[] = [];
  let pricedWears = 0;
  let totalWears = 0;
  let unwornCount = 0;
  const favorites: number[] = [];
  let fitRatedCount = 0;
  let justCount = 0;

  for (const it of items) {
    const price = priceOf(it);
    totalWears += it.wearCount;
    if (it.wearCount === 0) unwornCount += 1;
    if (price !== undefined) {
      prices.push(price);
      pricedWears += it.wearCount;
    }
    if (it.favoriteScore !== undefined) favorites.push(it.favoriteScore);
    if (it.fitRating !== undefined) {
      fitRatedCount += 1;
      if (it.fitRating === 'just') justCount += 1;
    }
  }

  const totalAmount = prices.reduce((a, b) => a + b, 0);
  const count = items.length;
  return {
    count,
    pricedCount: prices.length,
    totalAmount,
    averagePrice: mean(prices),
    medianPrice: median(prices),
    totalWears,
    averageWears: count === 0 ? null : totalWears / count,
    unwornCount,
    unwornRate: count === 0 ? null : unwornCount / count,
    costPerWear: pricedWears === 0 ? null : totalAmount / pricedWears,
    averageFavorite: mean(favorites),
    fitRatedCount,
    justFitRate: fitRatedCount === 0 ? null : justCount / fitRatedCount,
  };
};
