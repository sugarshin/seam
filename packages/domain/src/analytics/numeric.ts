/**
 * Linear-interpolated quantile (same definition as numpy's default) over an
 * ascending-sorted array. Returns null for an empty input.
 */
export const quantile = (sorted: readonly number[], q: number): number | null => {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = sorted[Math.floor(pos)];
  const hi = sorted[Math.ceil(pos)];
  if (lo === undefined || hi === undefined) return null;
  return lo + (hi - lo) * (pos - Math.floor(pos));
};

export const sortAsc = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

export const median = (values: readonly number[]): number | null => quantile(sortAsc(values), 0.5);

export const mean = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
};
