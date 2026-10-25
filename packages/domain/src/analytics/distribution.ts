import type { GarmentItem } from '@seam/shared';
import { priceOf } from './types';

export type DistributionEntry<K extends string> = {
  key: K;
  count: number;
  /** count / (items with a known key). */
  share: number;
  /** Sum of prices of the items in this bucket. */
  amount: number;
};

export type Distribution<K extends string> = {
  entries: DistributionEntry<K>[];
  /** Items for which `pick` returned null / undefined (missing or unclassifiable). */
  unknownCount: number;
};

type DistributionOptions<K extends string> = {
  /** Fixed display order. Without it entries sort by count desc. */
  order?: readonly K[];
  /** With `order`, keep keys that have zero items. */
  includeEmpty?: boolean;
};

type Priced = Pick<GarmentItem, 'totalPrice' | 'purchasePrice'>;

/**
 * Bucket `items` by `pick` and report count / share / amount per bucket.
 * Unordered results sort by count desc, then amount desc, then key.
 */
export const distributionBy = <T extends Priced, K extends string>(
  items: readonly T[],
  pick: (item: T) => K | null | undefined,
  options: DistributionOptions<K> = {},
): Distribution<K> => {
  const buckets = new Map<K, { count: number; amount: number }>();
  let unknownCount = 0;
  for (const it of items) {
    const key = pick(it);
    if (key === null || key === undefined) {
      unknownCount += 1;
      continue;
    }
    const b = buckets.get(key) ?? { count: 0, amount: 0 };
    b.count += 1;
    b.amount += priceOf(it) ?? 0;
    buckets.set(key, b);
  }

  const known = items.length - unknownCount;
  const toEntry = (key: K, b: { count: number; amount: number }): DistributionEntry<K> => ({
    key,
    count: b.count,
    share: known === 0 ? 0 : b.count / known,
    amount: b.amount,
  });

  const { order, includeEmpty = false } = options;
  if (order) {
    const entries: DistributionEntry<K>[] = [];
    for (const key of order) {
      const b = buckets.get(key);
      if (b) entries.push(toEntry(key, b));
      else if (includeEmpty) entries.push(toEntry(key, { count: 0, amount: 0 }));
    }
    return { entries, unknownCount };
  }

  const entries = Array.from(buckets, ([key, b]) => toEntry(key, b));
  entries.sort((a, b) => b.count - a.count || b.amount - a.amount || a.key.localeCompare(b.key));
  return { entries, unknownCount };
};

export type CrossTab<R extends string, C extends string> = {
  rows: R[];
  cols: C[];
  /** counts[rowIndex][colIndex] */
  counts: number[][];
  max: number;
};

/**
 * Two-way contingency table. Rows / columns with no items are dropped. Rows
 * sort by total desc unless `rowOrder` is given; columns follow `colOrder`
 * (or total desc).
 */
export const crossTabulate = <T, R extends string, C extends string>(
  items: readonly T[],
  pickRow: (item: T) => R | null | undefined,
  pickCol: (item: T) => C | null | undefined,
  options: { rowOrder?: readonly R[]; colOrder?: readonly C[] } = {},
): CrossTab<R, C> => {
  const cells = new Map<R, Map<C, number>>();
  const rowTotals = new Map<R, number>();
  const colTotals = new Map<C, number>();
  for (const it of items) {
    const r = pickRow(it);
    const c = pickCol(it);
    if (r === null || r === undefined || c === null || c === undefined) continue;
    const row = cells.get(r) ?? new Map<C, number>();
    row.set(c, (row.get(c) ?? 0) + 1);
    cells.set(r, row);
    rowTotals.set(r, (rowTotals.get(r) ?? 0) + 1);
    colTotals.set(c, (colTotals.get(c) ?? 0) + 1);
  }

  const byTotal = <K extends string>(totals: Map<K, number>, order?: readonly K[]): K[] =>
    order
      ? order.filter((k) => totals.has(k))
      : Array.from(totals.keys()).sort(
          (a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b),
        );

  const rows = byTotal(rowTotals, options.rowOrder);
  const cols = byTotal(colTotals, options.colOrder);
  let max = 0;
  const counts = rows.map((r) =>
    cols.map((c) => {
      const n = cells.get(r)?.get(c) ?? 0;
      if (n > max) max = n;
      return n;
    }),
  );
  return { rows, cols, counts, max };
};
