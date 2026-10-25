import type { AnalyticsItem, SoldAnalyticsItem } from '@seam/domain';
import { itemRepository, measurementRepository, wearLogRepository } from '../repositories';

export type AnalyticsData = {
  owned: AnalyticsItem[];
  sold: SoldAnalyticsItem[];
};

/**
 * Load everything the Analytics screen slices: owned items joined with their
 * wear counts and measurements, plus sold items with their sold price.
 * Read-only.
 */
export const loadAnalyticsData = async (): Promise<AnalyticsData> => {
  const [owned, sold] = await Promise.all([itemRepository.listOwned(), itemRepository.listSold()]);
  const ids = owned.map((it) => it.id);
  const [wearCounts, measurements] = await Promise.all([
    wearLogRepository.countsByItems(ids),
    measurementRepository.listByItems(ids),
  ]);
  return {
    owned: owned.map((it) => ({
      ...it,
      wearCount: wearCounts[it.id] ?? 0,
      measurements: measurements[it.id] ?? [],
    })),
    sold: sold.map(({ saleInfo, ...it }) => ({ ...it, soldPrice: saleInfo.soldPrice })),
  };
};
