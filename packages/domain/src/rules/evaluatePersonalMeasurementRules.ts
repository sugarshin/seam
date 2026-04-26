import type {
  GarmentCategory,
  Measurement,
  MeasurementKey,
  MeasurementRule,
  MeasurementUnit,
} from '@seam/shared';
import { isComparableUnitPair, toCm } from '../units';

export type RuleViolation = {
  ruleId: string;
  measurementKey: MeasurementKey;
  severity: 'warning' | 'ng';
  message: string;
};

const compare = (op: MeasurementRule['operator'], lhs: number, rhs: number): boolean => {
  switch (op) {
    case 'lt':
      return lhs < rhs;
    case 'lte':
      return lhs <= rhs;
    case 'gt':
      return lhs > rhs;
    case 'gte':
      return lhs >= rhs;
  }
};

/**
 * Personal NG / warning rules — e.g. "shoulderWidth < 47 → ng (too narrow)".
 *
 * - `rules` is filtered to those that match `category` (rules for other
 *   categories are ignored).
 * - For each remaining rule we look up the measurement with the same key and
 *   compare with the rule's operator.
 * - Cm/inch values are normalised to cm before comparison; rules are assumed
 *   to be authored in cm (the only writable length unit in the rule UI).
 *   Shoes-size rules (jp/us/...) are only applied to measurements with the
 *   exact same unit; mismatched units skip the rule.
 */
export const evaluatePersonalMeasurementRules = (
  itemMeasurements: readonly Measurement[],
  rules: readonly MeasurementRule[],
  category: GarmentCategory,
): RuleViolation[] => {
  const out: RuleViolation[] = [];
  for (const rule of rules) {
    if (rule.category !== category) continue;
    const measurement = itemMeasurements.find((m) => m.key === rule.measurementKey);
    if (!measurement) continue;

    const ruleUnit: MeasurementUnit = isLengthKey(rule.measurementKey) ? 'cm' : measurement.unit;
    if (!isComparableUnitPair(ruleUnit, measurement.unit)) continue;

    const measurementCm = isLengthKey(rule.measurementKey)
      ? toCm(measurement.value, measurement.unit)
      : measurement.value;
    const ruleValueCm = isLengthKey(rule.measurementKey)
      ? rule.value // rule values for length keys are authored in cm
      : rule.value;

    if (compare(rule.operator, measurementCm, ruleValueCm)) {
      out.push({
        ruleId: rule.id,
        measurementKey: rule.measurementKey,
        severity: rule.severity,
        message: rule.message,
      });
    }
  }
  return out;
};

const isLengthKey = (key: MeasurementKey): boolean => !isShoesSizeKey(key);

const isShoesSizeKey = (key: MeasurementKey): boolean =>
  key === 'jpSize' || key === 'usSize' || key === 'ukSize' || key === 'euSize';
