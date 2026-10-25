import { PRICE_BANDS, type GarmentItem, type PriceBand } from '@seam/shared';
import { type Distribution, distributionBy } from './distribution';
import { priceOf } from './types';

export const priceBandOf = (price: number): PriceBand | null =>
  PRICE_BANDS.find((b) => price >= b.min && (b.max === null || price < b.max)) ?? null;

/** Items per `PRICE_BANDS` bucket (all bands present, keyed by label). */
export const priceBandDistribution = (
  items: readonly Pick<GarmentItem, 'totalPrice' | 'purchasePrice'>[],
): Distribution<string> =>
  distributionBy(
    items,
    (it) => {
      const price = priceOf(it);
      return price === undefined ? null : (priceBandOf(price)?.label ?? null);
    },
    { order: PRICE_BANDS.map((b) => b.label), includeEmpty: true },
  );
