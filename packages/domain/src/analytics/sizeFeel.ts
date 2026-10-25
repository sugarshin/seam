import type { MeasurementKey, MeasurementUnit } from '@seam/shared';
import { collectMeasurement } from './measurementStats';
import { median } from './numeric';
import { nameKey, normalizeSizeLabel } from './text';
import type { AnalyticsItem } from './types';

export type SizeFeelBrand = {
  brandKey: string;
  brand: string;
  count: number;
  median: number;
};

export type SizeFeelGroup = {
  sizeLabel: string;
  count: number;
  median: number;
  /** Brands sorted by median ascending (smallest-running first). */
  brands: SizeFeelBrand[];
  /** Largest − smallest brand median. null with fewer than two brands. */
  spread: number | null;
};

export type SizeFeel = {
  key: MeasurementKey;
  unit: MeasurementUnit | null;
  /** Size labels sorted by median ascending, which orders S < M < L naturally. */
  groups: SizeFeelGroup[];
};

/**
 * How the same size label measures across brands ("L" at brand A is 54cm
 * wide, at brand B 58cm). Only items with a brand, a size label and the
 * `key` measurement participate.
 */
export const sizeFeelByLabel = (items: readonly AnalyticsItem[], key: MeasurementKey): SizeFeel => {
  const eligible = items.filter(
    (it) => nameKey(it.brand) !== null && normalizeSizeLabel(it.sizeLabel) !== null,
  );
  const { unit, values } = collectMeasurement(eligible, key);

  const bySize = new Map<string, Map<string, { brand: string; values: number[] }>>();
  for (const { item, value } of values) {
    const size = normalizeSizeLabel(item.sizeLabel);
    const brandKey = nameKey(item.brand);
    if (size === null || brandKey === null) continue;
    const brands = bySize.get(size) ?? new Map<string, { brand: string; values: number[] }>();
    const b = brands.get(brandKey) ?? { brand: (item.brand ?? '').trim(), values: [] };
    b.values.push(value);
    brands.set(brandKey, b);
    bySize.set(size, brands);
  }

  const groups: SizeFeelGroup[] = [];
  for (const [sizeLabel, brandMap] of bySize) {
    const brands: SizeFeelBrand[] = [];
    const all: number[] = [];
    for (const [brandKey, b] of brandMap) {
      const m = median(b.values);
      if (m === null) continue;
      brands.push({ brandKey, brand: b.brand, count: b.values.length, median: m });
      all.push(...b.values);
    }
    const groupMedian = median(all);
    if (groupMedian === null) continue;
    brands.sort((a, b) => a.median - b.median || a.brand.localeCompare(b.brand));
    const first = brands[0];
    const last = brands[brands.length - 1];
    groups.push({
      sizeLabel,
      count: all.length,
      median: groupMedian,
      brands,
      spread: brands.length >= 2 && first && last ? last.median - first.median : null,
    });
  }
  groups.sort((a, b) => a.median - b.median || a.sizeLabel.localeCompare(b.sizeLabel));
  return { key, unit, groups };
};
