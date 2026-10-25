import {
  categoriesOfMajor,
  measurementKeysFor,
  type MajorCategory,
  type MeasurementKey,
  type MeasurementUnit,
} from '@seam/shared';
import { toCm } from '../units';
import { quantile, sortAsc } from './numeric';
import { type AnalyticsItem, type AnalyticsMeasurement, isWellFitting } from './types';

/** Union of measurement keys across the categories of `major`, in input-form order. */
export const measurementKeysForMajor = (major: MajorCategory): MeasurementKey[] => {
  const out: MeasurementKey[] = [];
  for (const category of categoriesOfMajor(major)) {
    for (const key of measurementKeysFor(category)) {
      if (!out.includes(key)) out.push(key);
    }
  }
  return out;
};

const canonical = (m: AnalyticsMeasurement): { value: number; unit: MeasurementUnit } =>
  m.unit === 'cm' || m.unit === 'inch'
    ? { value: toCm(m.value, m.unit), unit: 'cm' }
    : { value: m.value, unit: m.unit };

/**
 * Values of `key` across `items`, converted so they are comparable: cm and
 * inch are merged as cm, and shoe-size units are kept only for the unit most
 * items use (JP sizes cannot be averaged with US sizes).
 */
export const collectMeasurement = <T extends AnalyticsItem>(
  items: readonly T[],
  key: MeasurementKey,
): { unit: MeasurementUnit | null; values: { item: T; value: number }[] } => {
  const byUnit = new Map<MeasurementUnit, { item: T; value: number }[]>();
  for (const item of items) {
    const m = item.measurements.find((x) => x.key === key);
    if (!m) continue;
    const c = canonical(m);
    const list = byUnit.get(c.unit) ?? [];
    list.push({ item, value: c.value });
    byUnit.set(c.unit, list);
  }
  let unit: MeasurementUnit | null = null;
  let values: { item: T; value: number }[] = [];
  for (const [u, list] of byUnit) {
    if (list.length > values.length) {
      unit = u;
      values = list;
    }
  }
  return { unit, values };
};

export type RangeStats = {
  count: number;
  min: number;
  median: number;
  max: number;
};

export type MeasurementSummary = RangeStats & {
  key: MeasurementKey;
  unit: MeasurementUnit;
  p25: number;
  p75: number;
  /**
   * Range of the items that fit well (fit rating "just" or fit anchor):
   * the size window worth targeting when buying. null when none are rated.
   */
  fit: RangeStats | null;
};

const rangeOf = (sorted: readonly number[]): RangeStats | null => {
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const med = quantile(sorted, 0.5);
  if (min === undefined || max === undefined || med === null) return null;
  return { count: sorted.length, min, median: med, max };
};

/**
 * Per-key distribution of measurements across `items`. Keys nobody has
 * measured are omitted; output follows the order of `keys`.
 */
export const summarizeMeasurements = (
  items: readonly AnalyticsItem[],
  keys: readonly MeasurementKey[],
): MeasurementSummary[] => {
  const out: MeasurementSummary[] = [];
  for (const key of keys) {
    const { unit, values } = collectMeasurement(items, key);
    const sorted = sortAsc(values.map((v) => v.value));
    const range = rangeOf(sorted);
    const p25 = quantile(sorted, 0.25);
    const p75 = quantile(sorted, 0.75);
    if (unit === null || range === null || p25 === null || p75 === null) continue;
    const fitSorted = sortAsc(values.filter((v) => isWellFitting(v.item)).map((v) => v.value));
    out.push({ key, unit, ...range, p25, p75, fit: rangeOf(fitSorted) });
  }
  return out;
};
