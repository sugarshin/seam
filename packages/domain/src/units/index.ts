import type { MeasurementUnit } from '@seam/shared';

const CM_PER_INCH = 2.54;

/**
 * Convert inches to centimetres.
 */
export const cmFromInch = (inch: number): number => inch * CM_PER_INCH;

/**
 * Convert centimetres to inches.
 */
export const inchFromCm = (cm: number): number => cm / CM_PER_INCH;

/**
 * Convert a `value` of `unit` to centimetres when possible.
 *
 * - `cm`   → returned as-is.
 * - `inch` → multiplied by 2.54.
 * - `jp` / `us` / `uk` / `eu` (shoes sizes): conversion is non-trivial and
 *   v1 simply returns the value unchanged. Callers should treat shoes sizes
 *   as compatible *only* when the units match exactly (see `isComparableUnitPair`).
 */
export const toCm = (value: number, unit: MeasurementUnit): number => {
  switch (unit) {
    case 'cm':
      return value;
    case 'inch':
      return cmFromInch(value);
    case 'jp':
    case 'us':
    case 'uk':
    case 'eu':
      return value;
  }
};

/**
 * Returns true when two measurements can be compared numerically.
 *
 * - cm/inch are interchangeable (both convert to cm cleanly).
 * - shoes sizes (jp/us/uk/eu) are *only* comparable to themselves.
 */
export const isComparableUnitPair = (a: MeasurementUnit, b: MeasurementUnit): boolean => {
  const isLength = (u: MeasurementUnit): boolean => u === 'cm' || u === 'inch';
  if (isLength(a) && isLength(b)) return true;
  return a === b;
};
