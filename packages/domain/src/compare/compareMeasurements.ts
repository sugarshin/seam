import {
  measurementKeysFor,
  type GarmentCategory,
  type Measurement,
  type MeasurementKey,
} from '@seam/shared';
import { isComparableUnitPair, toCm } from '../units';

export type MeasurementDiff = {
  key: MeasurementKey;
  candidateValue: number;
  referenceValue: number;
  /** candidate - reference, in cm (or original unit for shoes sizes). */
  diffCm: number;
  /** diffCm / referenceValue (signed). 0 if reference is 0. */
  diffPct: number;
  /** True when both measurements were comparable (same unit family). */
  comparable: boolean;
};

/**
 * Find the first measurement that matches `key`. Multiple entries for the same
 * key are not expected (the input editor enforces one per key) but if they
 * exist we just take the first.
 */
const findByKey = (
  measurements: readonly Measurement[],
  key: MeasurementKey,
): Measurement | undefined => measurements.find((m) => m.key === key);

/**
 * Compare a candidate's measurements against a reference set (e.g. a Fit Anchor
 * or another owned garment) for the given category.
 *
 * - Only keys that belong to the category's measurement group are considered
 *   (`measurementKeysFor`).
 * - Keys present on only one side are skipped entirely (no entry in the
 *   returned array).
 * - cm/inch values are normalised to cm before subtracting.
 * - Shoes size units (jp/us/uk/eu) are *only* compared to identical units;
 *   different units are returned with `comparable: false` so the UI can show
 *   them but skip the severity/diff math.
 */
export const compareMeasurements = (
  candidate: readonly Measurement[],
  reference: readonly Measurement[],
  category: GarmentCategory,
): MeasurementDiff[] => {
  const keys = measurementKeysFor(category);
  const out: MeasurementDiff[] = [];
  for (const key of keys) {
    const c = findByKey(candidate, key);
    const r = findByKey(reference, key);
    if (!c || !r) continue;

    const comparable = isComparableUnitPair(c.unit, r.unit);
    if (!comparable) {
      out.push({
        key,
        candidateValue: c.value,
        referenceValue: r.value,
        diffCm: 0,
        diffPct: 0,
        comparable: false,
      });
      continue;
    }

    const candCm = toCm(c.value, c.unit);
    const refCm = toCm(r.value, r.unit);
    const diffCm = candCm - refCm;
    const diffPct = refCm === 0 ? 0 : diffCm / refCm;
    out.push({
      key,
      candidateValue: c.value,
      referenceValue: r.value,
      diffCm,
      diffPct,
      comparable: true,
    });
  }
  return out;
};
