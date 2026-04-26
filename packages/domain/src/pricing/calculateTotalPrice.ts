/**
 * Sum the price and shipping fee. Either missing is treated as 0.
 * If both are missing, returns 0.
 */
export const calculateTotalPrice = (price?: number, shippingFee?: number): number => {
  const p = typeof price === 'number' && Number.isFinite(price) ? price : 0;
  const s =
    typeof shippingFee === 'number' && Number.isFinite(shippingFee) ? shippingFee : 0;
  return p + s;
};
