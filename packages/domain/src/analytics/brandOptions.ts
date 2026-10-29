import { nameKey } from './text';

/**
 * Collapse raw brand spellings (one entry per item / guide) into one
 * selectable label per brand. Grouped by `nameKey`, the same identity
 * `brandStats` uses, so the picker never offers two labels that analytics
 * would count as one brand. The most frequent spelling wins; ties go to the
 * first one seen. Sorted by key for a stable list.
 */
export const brandOptions = (names: readonly (string | null | undefined)[]): string[] => {
  const groups = new Map<string, Map<string, number>>();
  for (const raw of names) {
    const key = nameKey(raw);
    if (key === null || raw === null || raw === undefined) continue;
    const label = raw.trim();
    const spellings = groups.get(key) ?? new Map<string, number>();
    spellings.set(label, (spellings.get(label) ?? 0) + 1);
    groups.set(key, spellings);
  }

  const options: { key: string; label: string }[] = [];
  for (const [key, spellings] of groups) {
    let best = '';
    let bestCount = 0;
    for (const [label, count] of spellings) {
      if (count > bestCount) {
        best = label;
        bestCount = count;
      }
    }
    options.push({ key, label: best });
  }
  options.sort((a, b) => a.key.localeCompare(b.key));
  return options.map((o) => o.label);
};

// Search-only key: also drops spaces and punctuation so "levis" finds
// "Levi's" and "northface" finds "The North Face". Identity (exact match)
// stays on `nameKey`.
const searchKey = (raw: string): string =>
  (nameKey(raw) ?? '').replace(/[\s'"`.,:;!?&+\-_/\\・()]/g, '');

export type BrandSearchResult = {
  /** Options matching the query; prefix matches first. All options when the query is blank. */
  matches: string[];
  /** The option that is the same brand as the query, if any. */
  exact: string | undefined;
  /** Label to register as a new brand; undefined when blank or `exact` exists. */
  createLabel: string | undefined;
};

/**
 * Filter brand options by a free-text query. When the query is a spelling
 * variant of an existing brand (case / width / curly quote), `exact` points
 * at it and `createLabel` is withheld so the UI can't register a duplicate.
 */
export const searchBrandOptions = (
  options: readonly string[],
  query: string,
): BrandSearchResult => {
  const queryKey = nameKey(query);
  if (queryKey === null) return { matches: [...options], exact: undefined, createLabel: undefined };

  const q = searchKey(query);
  const prefix: string[] = [];
  const infix: string[] = [];
  let exact: string | undefined;
  for (const option of options) {
    if (exact === undefined && nameKey(option) === queryKey) exact = option;
    const k = searchKey(option);
    if (k.startsWith(q)) prefix.push(option);
    else if (k.includes(q)) infix.push(option);
  }
  return {
    matches: [...prefix, ...infix],
    exact,
    createLabel: exact === undefined ? query.trim().replace(/\s+/g, ' ') : undefined,
  };
};
