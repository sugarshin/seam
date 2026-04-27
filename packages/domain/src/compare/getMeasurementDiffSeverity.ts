import {
  DEFAULT_THRESHOLDS_BY_GROUP,
  DIRECTIONAL_WARNING_RULES,
  measurementGroupOf,
  type GarmentCategory,
  type MeasurementDiffSeverity,
  type SeverityThresholds,
} from '@seam/shared';
import type { MeasurementDiff } from './compareMeasurements';

/**
 * Severity for a single MeasurementDiff.
 *
 * Algorithm
 * ─────────
 *
 * 1. **Directional rule (top priority).** Some keys (e.g. `bodyLength`,
 *    `sleeveLength`) become `warning` once the candidate is enough cm shorter
 *    than the reference. The rule's `sign` describes which direction is bad
 *    and `absAtWarning` the threshold; encountering it short-circuits the
 *    rest of the severity logic.
 * 2. **Default thresholds.** Otherwise we evaluate against the category
 *    group's defaults. We compare both absolute cm (`|diffCm|`) and percentage
 *    (`|diffPct|`) and use the **looser** of the two — i.e. the diff is
 *    classified at level `L` when *either* the absolute or the percentage
 *    threshold passes. This way a tiny absolute diff on a small measurement
 *    (e.g. shoes outsole 0.4cm = 1.5%) doesn't get over-rated as a problem
 *    on a forgiving percent threshold, and a small percentage on a giant
 *    measurement (e.g. coat bodyLength 0.5cm of 80cm) still gets credit.
 *
 *    The classification levels — checked in order — are `same` → `close` →
 *    `different`; anything beyond `different` collapses to `warning`.
 *
 * Items that are not comparable (mismatched shoes-size units) are returned as
 * `different` because we have no signal either way.
 */
export const getMeasurementDiffSeverity = (
  diff: MeasurementDiff,
  category: GarmentCategory,
): MeasurementDiffSeverity => {
  if (!diff.comparable) return 'different';

  // Directional warning takes precedence regardless of magnitude.
  const directional = DIRECTIONAL_WARNING_RULES[diff.key];
  if (directional) {
    if (directional.sign === 'negative' && diff.diffCm <= -directional.absAtWarning) {
      return 'warning';
    }
    if (directional.sign === 'positive' && diff.diffCm >= directional.absAtWarning) {
      return 'warning';
    }
  }

  const thresholds: SeverityThresholds = DEFAULT_THRESHOLDS_BY_GROUP[measurementGroupOf(category)];

  const absDiff = Math.abs(diff.diffCm);
  const absPct = Math.abs(diff.diffPct);

  // "Looser of the two" → take the *minimum* normalised score across the
  // absolute-cm and the percentage axis. A normalised score <= 1 means the
  // diff is within that level's threshold.
  const within = (abs: number, pct: number): boolean => Math.min(absDiff / abs, absPct / pct) <= 1;

  if (within(thresholds.sameAbs, thresholds.samePct)) return 'same';
  if (within(thresholds.closeAbs, thresholds.closePct)) return 'close';
  if (within(thresholds.differentAbs, thresholds.differentPct)) return 'different';
  return 'warning';
};
