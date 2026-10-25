/**
 * Normalize free-text input for matching: NFKC folds full-width ASCII and
 * half-width katakana, then lowercase + trim + collapse whitespace.
 */
export const normalizeText = (raw: string): string =>
  raw.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Size labels are compared case-insensitively ("l" == "L", "ｗ３２" == "W32").
 * Returns null for missing / blank input.
 */
export const normalizeSizeLabel = (raw: string | undefined | null): string | null => {
  if (raw === undefined || raw === null) return null;
  const s = raw.normalize('NFKC').replace(/\s+/g, '').toUpperCase();
  return s === '' ? null : s;
};

/**
 * Grouping key for free-text names (brand, purchase source) so that
 * "Levi's", "LEVI'S" and "ｌｅｖｉ’ｓ" land in the same bucket.
 */
export const nameKey = (raw: string | undefined | null): string | null => {
  if (raw === undefined || raw === null) return null;
  const s = normalizeText(raw).replace(/[’‘`´]/g, "'");
  return s === '' ? null : s;
};
