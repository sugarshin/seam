import type { MeasurementKey } from './measurementKeys';
import type { MeasurementCategoryGroup } from './categories';

export const SEVERITIES = ['same', 'close', 'different', 'warning'] as const;
export type MeasurementDiffSeverity = (typeof SEVERITIES)[number];

export type SeverityThresholds = {
  /** absolute cm difference for `same` */
  sameAbs: number;
  /** absolute cm difference for `close` */
  closeAbs: number;
  /** absolute cm difference for `different` */
  differentAbs: number;
  /** percentage difference (vs reference) thresholds — applied in addition */
  samePct: number;
  closePct: number;
  differentPct: number;
};

const TOP_DEFAULTS: SeverityThresholds = {
  sameAbs: 1,
  closeAbs: 3,
  differentAbs: 5,
  samePct: 0.015,
  closePct: 0.04,
  differentPct: 0.08,
};

const PANTS_DEFAULTS: SeverityThresholds = {
  sameAbs: 1,
  closeAbs: 2,
  differentAbs: 4,
  samePct: 0.015,
  closePct: 0.03,
  differentPct: 0.06,
};

const SHOES_DEFAULTS: SeverityThresholds = {
  sameAbs: 0.3,
  closeAbs: 0.5,
  differentAbs: 1,
  samePct: 0.01,
  closePct: 0.02,
  differentPct: 0.04,
};

export const DEFAULT_THRESHOLDS_BY_GROUP: Record<MeasurementCategoryGroup, SeverityThresholds> = {
  top: TOP_DEFAULTS,
  pants: PANTS_DEFAULTS,
  shoes: SHOES_DEFAULTS,
  none: TOP_DEFAULTS,
};

/**
 * Per-key directional warnings: e.g. `bodyLength` -4cm is warning regardless of magnitude.
 */
export type DirectionalRule = {
  /** sign: `negative` means candidate < reference is bad. */
  sign: 'positive' | 'negative';
  /** absolute cm value at which severity becomes `warning` */
  absAtWarning: number;
};

export const DIRECTIONAL_WARNING_RULES: Partial<Record<MeasurementKey, DirectionalRule>> = {
  bodyLength: { sign: 'negative', absAtWarning: 4 },
  sleeveLength: { sign: 'negative', absAtWarning: 4 },
  inseam: { sign: 'negative', absAtWarning: 3 },
};

export const SEVERITY_LABEL: Record<MeasurementDiffSeverity, string> = {
  same: '同じ',
  close: 'ほぼ同じ',
  different: 'やや違う',
  warning: '注意',
};
