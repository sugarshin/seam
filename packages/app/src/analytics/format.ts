import type { MeasurementUnit } from '@seam/shared';

export const formatYen = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : `¥${Math.round(n).toLocaleString()}`;

export const formatPercent = (ratio: number | null | undefined): string =>
  ratio === null || ratio === undefined ? '—' : `${Math.round(ratio * 100)}%`;

export const formatDecimal = (n: number | null | undefined, digits = 1): string =>
  n === null || n === undefined ? '—' : n.toFixed(digits);

/** "55.5cm" for lengths, "JP 27" / "US 9.5" for shoe sizes. */
export const formatMeasurement = (value: number, unit: MeasurementUnit): string => {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit === 'cm' || unit === 'inch' ? `${text}${unit}` : `${unit.toUpperCase()} ${text}`;
};
