import { calculateCostPerWear } from './calculateCostPerWear';

/**
 * Cost per wear including resale recovery.
 *
 *   netCostPerWear = (totalPrice - soldPrice) / wearCount
 *
 * If `soldPrice` is missing (item not yet sold), this falls back to the
 * basic {@link calculateCostPerWear}. The same null-rules apply otherwise:
 *   - missing inputs / wearCount === 0 → null
 *   - non-finite numbers → null
 *   - net cost can be negative (soldPrice > totalPrice), which is valid:
 *     the item ended up profitable per wear.
 */
export const calculateNetCostPerWear = (
  totalPrice?: number,
  wearCount?: number,
  soldPrice?: number,
): number | null => {
  if (typeof totalPrice !== 'number' || !Number.isFinite(totalPrice)) return null;
  if (typeof wearCount !== 'number' || !Number.isFinite(wearCount)) return null;

  if (typeof soldPrice !== 'number' || !Number.isFinite(soldPrice)) {
    return calculateCostPerWear(totalPrice, wearCount);
  }

  const count = Math.max(0, wearCount);
  if (count === 0) return null;

  const recovered = Math.max(0, soldPrice);
  const net = totalPrice - recovered;
  return net / count;
};
