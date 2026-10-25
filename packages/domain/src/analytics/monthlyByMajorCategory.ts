import {
  MAJOR_CATEGORIES,
  majorCategoryOf,
  type GarmentItem,
  type MajorCategory,
} from '@seam/shared';
import { priceOf } from './types';

export type MonthlyAmount = { count: number; amount: number };

export type MonthlyMajorBucket = MonthlyAmount & {
  /** YYYY-MM */
  month: string;
  byMajor: Record<MajorCategory, MonthlyAmount>;
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * `YYYY-MM` of a purchase date. Date-only strings are read literally so a
 * "2026-03-01" purchase never shifts into February in a negative-offset
 * timezone; anything else goes through `Date` in local time.
 */
const yearMonthOf = (raw: string | undefined): string | null => {
  if (raw === undefined || raw === '') return null;
  const dateOnly = /^(\d{4})-(\d{2})-\d{2}$/.exec(raw);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const emptyByMajor = (): Record<MajorCategory, MonthlyAmount> =>
  Object.fromEntries(MAJOR_CATEGORIES.map((m) => [m, { count: 0, amount: 0 }])) as Record<
    MajorCategory,
    MonthlyAmount
  >;

/**
 * Purchases per month for the last `months` months ending at `now` (oldest
 * first, empty months included), split by major category.
 */
export const monthlyByMajorCategory = (
  items: readonly GarmentItem[],
  now: Date,
  months: number,
): MonthlyMajorBucket[] => {
  const buckets = new Map<string, MonthlyMajorBucket>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    buckets.set(month, { month, count: 0, amount: 0, byMajor: emptyByMajor() });
  }
  for (const it of items) {
    const month = yearMonthOf(it.purchaseDate);
    const bucket = month === null ? undefined : buckets.get(month);
    if (!bucket) continue;
    const amount = priceOf(it) ?? 0;
    const major = bucket.byMajor[majorCategoryOf(it.category)];
    bucket.count += 1;
    bucket.amount += amount;
    major.count += 1;
    major.amount += amount;
  }
  return Array.from(buckets.values());
};
