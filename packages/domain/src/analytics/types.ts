import type { GarmentItem, Measurement } from '@seam/shared';

export type AnalyticsMeasurement = Pick<Measurement, 'key' | 'value' | 'unit'>;

/** Owned item joined with the per-item data the Analytics screen needs. */
export type AnalyticsItem = GarmentItem & {
  wearCount: number;
  measurements: readonly AnalyticsMeasurement[];
};

export type SoldAnalyticsItem = GarmentItem & {
  soldPrice?: number;
};

/** Price used for every analytics amount: shipping-inclusive total, falling back to the item price. */
export const priceOf = (
  item: Pick<GarmentItem, 'totalPrice' | 'purchasePrice'>,
): number | undefined => item.totalPrice ?? item.purchasePrice;

/**
 * Items whose measurements describe a size that fits: rated "just", or
 * registered as a fit anchor (the reference garments candidates are compared
 * against).
 */
export const isWellFitting = (item: Pick<GarmentItem, 'fitRating' | 'isFitAnchor'>): boolean =>
  item.fitRating === 'just' || item.isFitAnchor;
