import { type SoldAnalyticsItem, priceOf } from './types';

export type SalesSummary = {
  count: number;
  /** Items with both a purchase price and a sold price. Totals use only these. */
  pricedCount: number;
  totalCost: number;
  totalProceeds: number;
  /** totalProceeds − totalCost (negative = loss). */
  profit: number;
  /** totalProceeds / totalCost. null when there is no cost to compare against. */
  recoveryRate: number | null;
};

export const summarizeSales = (items: readonly SoldAnalyticsItem[]): SalesSummary => {
  let pricedCount = 0;
  let totalCost = 0;
  let totalProceeds = 0;
  for (const it of items) {
    const cost = priceOf(it);
    if (cost === undefined || it.soldPrice === undefined) continue;
    pricedCount += 1;
    totalCost += cost;
    totalProceeds += it.soldPrice;
  }
  return {
    count: items.length,
    pricedCount,
    totalCost,
    totalProceeds,
    profit: totalProceeds - totalCost,
    recoveryRate: totalCost === 0 ? null : totalProceeds / totalCost,
  };
};
