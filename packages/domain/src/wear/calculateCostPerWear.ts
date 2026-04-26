/**
 * Cost per wear = totalPrice / wearCount.
 *
 * Returns null when the calculation is undefined (rather than `Infinity`),
 * which keeps callers from having to special-case display logic.
 *
 * Rules:
 *   - `totalPrice` or `wearCount` missing → null
 *   - `wearCount === 0` → null (avoid division by zero / Infinity)
 *   - Negative inputs are clamped to 0; if `totalPrice` becomes 0 the result is 0,
 *     and a clamped `wearCount` of 0 still yields null.
 *   - Non-finite numbers (NaN, ±Infinity) are treated as missing → null.
 */
export const calculateCostPerWear = (
  totalPrice?: number,
  wearCount?: number,
): number | null => {
  if (typeof totalPrice !== 'number' || !Number.isFinite(totalPrice)) return null;
  if (typeof wearCount !== 'number' || !Number.isFinite(wearCount)) return null;

  const price = Math.max(0, totalPrice);
  const count = Math.max(0, wearCount);
  if (count === 0) return null;

  return price / count;
};
