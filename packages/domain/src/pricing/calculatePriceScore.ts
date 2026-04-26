export type PriceScoreInput = {
  totalPrice?: number;
  easyBuyPrice?: number;
  acceptablePrice?: number;
  maxBidPrice?: number;
};

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/**
 * Returns a 0-100 score that grades how favorable totalPrice is against the
 * (optional) easy / acceptable / max thresholds.
 *
 * - totalPrice <= easyBuyPrice           → 100
 * - easyBuyPrice < totalPrice <= acceptablePrice → 80
 * - acceptablePrice < totalPrice <= maxBidPrice → 50
 * - totalPrice > maxBidPrice             → 0
 *
 * Thresholds that are missing simply collapse the band, e.g. without
 * easyBuyPrice the "100" band disappears and totalPrice <= acceptablePrice
 * starts at 80. With no thresholds and a totalPrice we still return the
 * neutral 50; with nothing at all we return 50.
 */
export const calculatePriceScore = (input: PriceScoreInput): number => {
  const total = isFiniteNumber(input.totalPrice) ? input.totalPrice : undefined;
  const easy = isFiniteNumber(input.easyBuyPrice) ? input.easyBuyPrice : undefined;
  const acceptable = isFiniteNumber(input.acceptablePrice)
    ? input.acceptablePrice
    : undefined;
  const max = isFiniteNumber(input.maxBidPrice) ? input.maxBidPrice : undefined;

  // Without a totalPrice we cannot compare anything → neutral.
  if (total === undefined) return 50;

  // Without any threshold to compare against → neutral.
  if (easy === undefined && acceptable === undefined && max === undefined) {
    return 50;
  }

  if (easy !== undefined && total <= easy) return 100;
  if (acceptable !== undefined && total <= acceptable) return 80;
  if (max !== undefined && total <= max) return 50;

  // Above every defined threshold.
  if (max !== undefined) return 0;

  // No max defined but we passed the lower thresholds → still acceptable but
  // outside the easy band. Fall through to the next-best band that exists.
  if (acceptable !== undefined) return 0;
  // Only easy was defined and total is above it.
  return 0;
};
