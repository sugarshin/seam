import type { GarmentItem, SaleInfo } from '@seam/shared';

/**
 * Item enriched with the sold-context derived metrics. Returned by `itemRepository.listSold`.
 * `recoveryRate` is undefined when soldPrice or totalPrice is missing/zero.
 * `netCpw` is null when the calculation cannot be performed (e.g. wearCount === 0).
 */
export type SoldItem = GarmentItem & {
  saleInfo: SaleInfo;
  recoveryRate?: number;
  netCpw: number | null;
  wearCount: number;
};

export const computeRecoveryRate = (
  soldPrice: number | undefined,
  totalPrice: number | undefined,
): number | undefined => {
  if (typeof soldPrice !== 'number' || !Number.isFinite(soldPrice)) return undefined;
  if (typeof totalPrice !== 'number' || !Number.isFinite(totalPrice) || totalPrice <= 0) {
    return undefined;
  }
  return soldPrice / totalPrice;
};

/**
 * Comparator for `recoveryRate_desc`. Items missing recoveryRate sort to the end.
 */
export const compareSoldByRecoveryRateDesc = (
  a: Pick<SoldItem, 'recoveryRate'>,
  b: Pick<SoldItem, 'recoveryRate'>,
): number => {
  const ar = a.recoveryRate;
  const br = b.recoveryRate;
  if (ar === undefined && br === undefined) return 0;
  if (ar === undefined) return 1;
  if (br === undefined) return -1;
  return br - ar;
};

/**
 * Comparator for `netCpw_asc`. Items with null netCpw sort to the end.
 */
export const compareSoldByNetCpwAsc = (
  a: Pick<SoldItem, 'netCpw'>,
  b: Pick<SoldItem, 'netCpw'>,
): number => {
  const an = a.netCpw;
  const bn = b.netCpw;
  if (an === null && bn === null) return 0;
  if (an === null) return 1;
  if (bn === null) return -1;
  return an - bn;
};

/**
 * Filter sold items by recoveryRate range. Items missing recoveryRate are
 * excluded when either bound is set.
 */
export const passesRecoveryRateBounds = (
  it: Pick<SoldItem, 'recoveryRate'>,
  min?: number,
  max?: number,
): boolean => {
  if (min === undefined && max === undefined) return true;
  if (it.recoveryRate === undefined) return false;
  if (min !== undefined && it.recoveryRate < min) return false;
  if (max !== undefined && it.recoveryRate > max) return false;
  return true;
};
