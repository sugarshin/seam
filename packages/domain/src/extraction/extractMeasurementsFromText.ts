import {
  measurementKeysFor,
  type GarmentCategory,
  type MeasurementInput,
  type MeasurementKey,
  type MeasurementUnit,
} from '@seam/shared';
import { cmFromInch } from '../units';

export type ExtractionConfidence = 'high' | 'medium' | 'low';

/**
 * Extraction yields values *without* an `itemId` — callers attach it when
 * persisting via `measurementRepository.upsertForItem(itemId, ...)`.
 */
export type ExtractedMeasurement = Omit<MeasurementInput, 'itemId'>;

export type MeasurementExtractionResult = {
  measurements: ExtractedMeasurement[];
  confidence: ExtractionConfidence;
  rawText: string;
  unmatchedKeys: string[];
};

// ─── Synonym table ──────────────────────────────────────────────────────────
//
// Maps Japanese aliases (and a few English ones) to the canonical
// `MeasurementKey`. Order matters only for documentation; the matching loop
// scans all keys.
//
// NOTE: When adding a synonym that is a *substring* of another, place the
// longer one first by sorting alias lists by length (handled below).
const KEY_SYNONYMS: Record<MeasurementKey, readonly string[]> = {
  shoulderWidth: ['肩幅', 'shoulder', 'shoulders'],
  chestWidth: ['身幅', 'バスト', '胸囲', 'chest', 'bust'],
  bodyLength: ['着丈', '総丈', '丈', 'length'],
  sleeveLength: ['袖丈', '袖', 'sleeve'],
  neckToSleeve: ['裄丈', '裄', 'neck to sleeve'],
  waist: ['ウエスト', 'ウェスト', 'waist', 'W', 'ｗ'],
  rise: ['股上', 'rise'],
  inseam: ['股下', 'inseam'],
  thighWidth: ['ワタリ', 'わたり', '股周り', 'thigh'],
  kneeWidth: ['膝幅', 'ヒザ幅', 'knee'],
  hemWidth: ['裾幅', '裾', 'hem'],
  totalLength: ['総丈', 'total length'],
  jpSize: ['JPサイズ', 'JP', '日本サイズ'],
  usSize: ['USサイズ', 'US'],
  ukSize: ['UKサイズ', 'UK'],
  euSize: ['EUサイズ', 'EU'],
  outsoleLength: ['アウトソール長', 'outsole length'],
  outsoleWidth: ['アウトソール幅', 'outsole width'],
};

// ─── Plausible value ranges (cm) ────────────────────────────────────────────
//
// Used to discard parsed numbers that fall outside reasonable garment
// dimensions (e.g. mistakenly grabbing "2024" from a year).
const VALID_RANGES: Partial<Record<MeasurementKey, readonly [number, number]>> = {
  shoulderWidth: [25, 80],
  chestWidth: [30, 100],
  bodyLength: [30, 130],
  sleeveLength: [10, 90],
  neckToSleeve: [30, 110],
  waist: [40, 140],
  rise: [15, 50],
  inseam: [40, 110],
  thighWidth: [15, 60],
  kneeWidth: [10, 50],
  hemWidth: [8, 60],
  totalLength: [30, 200],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert full-width digits to half-width. */
const normalizeDigits = (s: string): string =>
  s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

/** Normalize various whitespace / punctuation to a uniform set. */
const normalizeText = (s: string): string =>
  normalizeDigits(s)
    // full-width colon → half-width
    .replace(/：/g, ':')
    // full-width space → half-width
    .replace(/　/g, ' ')
    // tilde / wave → '-' so range expressions get the first number
    .replace(/[〜～~]/g, '-')
    // remove "約" / "およそ" prefix-style hints
    .replace(/(約|およそ)/g, ' ');

/** Escape a literal for use inside a RegExp. */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isInsideRange = (key: MeasurementKey, valueCm: number): boolean => {
  const range = VALID_RANGES[key];
  if (!range) {
    // No defined range → accept anything finite & positive (e.g. shoes sizes).
    return Number.isFinite(valueCm) && valueCm > 0;
  }
  const [min, max] = range;
  return valueCm >= min && valueCm <= max;
};

type ParsedMatch = {
  key: MeasurementKey;
  rawValue: number;
  unit: MeasurementUnit;
  /** Value in cm (for length units) used solely for range check. */
  cmEquivalent: number;
  /** Was a unit explicitly written (cm / inch / センチ)? */
  unitExplicit: boolean;
};

/**
 * Try to read a measurement value immediately following an alias hit.
 * Supports patterns like:
 *   - "肩幅 58"
 *   - "肩幅:58cm"
 *   - "肩幅：約58センチ"
 *   - "W32inch" / "32inch" with `unit` defaulting to inch
 *   - "肩幅 58/60 cm" (takes first value)
 *   - "肩幅 58-60 cm" (takes first value, range)
 */
const NUMBER_PATTERN = '(-?\\d+(?:\\.\\d+)?)';

const parseAfterAlias = (
  text: string,
  alias: string,
  startIndex: number,
): { value: number; unit: MeasurementUnit; unitExplicit: boolean; consumed: number } | null => {
  // Slice forward from after the alias.
  const after = text.slice(startIndex + alias.length);
  // Trim leading punctuation: spaces, ':', '=', etc.
  const cleaned = after.replace(/^[\s:：=・-]+/, '');
  const consumedHead = after.length - cleaned.length;
  // Find a number near the start. Allow up to a small char window so e.g.
  // "サイズ ≒ 58cm" still matches.
  const leading = cleaned.match(/^([^0-9０-９\n\r-]{0,4})?(-?\d+(?:\.\d+)?)/);
  if (!leading) return null;
  const numStr = leading[2];
  if (!numStr) return null;
  const value = Number(numStr);
  if (!Number.isFinite(value) || value <= 0) return null;
  const numEnd = cleaned.indexOf(numStr) + numStr.length;
  const tail = cleaned.slice(numEnd, numEnd + 8); // small lookahead for unit
  const m = tail.match(/^\s*(cm|センチ|㎝|inch|in|"|”)/i);
  let unit: MeasurementUnit = 'cm';
  let unitExplicit = false;
  if (m) {
    unitExplicit = true;
    const u = (m[1] ?? '').toLowerCase();
    if (u === 'inch' || u === 'in' || u === '"' || u === '”') unit = 'inch';
    else unit = 'cm';
  }
  return {
    value,
    unit,
    unitExplicit,
    consumed: consumedHead + numEnd + (m?.[0]?.length ?? 0),
  };
};

/**
 * Walk through `text` searching for each alias of each key. Returns *all*
 * raw parses; deduplication & range filtering happens later.
 */
const findAllParses = (text: string, keys: readonly MeasurementKey[]): ParsedMatch[] => {
  const results: ParsedMatch[] = [];
  for (const key of keys) {
    const aliases = (KEY_SYNONYMS[key] ?? [])
      .slice()
      // longest first → avoid '丈' winning over '袖丈'
      .sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const re = new RegExp(escapeRegExp(alias), 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const idx = m.index;
        // Avoid matching alias inside a longer alias of *another* key:
        // e.g. '丈' inside '着丈'. We check whether the previous char is one
        // of the allowed neighbour aliases, and skip if so.
        const prev = idx > 0 ? text[idx - 1] : '';
        if (prev && /[一-龥ぁ-んァ-ンー]/.test(prev) && alias.length === 1) {
          continue;
        }
        const parsed = parseAfterAlias(text, alias, idx);
        if (!parsed) continue;
        const valueCm = parsed.unit === 'inch' ? cmFromInch(parsed.value) : parsed.value;
        results.push({
          key,
          rawValue: parsed.value,
          unit: parsed.unit,
          cmEquivalent: valueCm,
          unitExplicit: parsed.unitExplicit,
        });
        // Move past this match to avoid infinite loop on zero-width matches.
        if (re.lastIndex === idx) re.lastIndex = idx + Math.max(1, alias.length);
      }
    }
  }
  return results;
};

/**
 * Pick the *best* parse per key (first valid range wins). Tracks keys whose
 * alias appeared but whose parse failed validation — exposed via
 * `unmatchedKeys`.
 */
const pickBestPerKey = (
  parses: ParsedMatch[],
): { picked: Map<MeasurementKey, ParsedMatch>; rejected: Set<MeasurementKey> } => {
  const picked = new Map<MeasurementKey, ParsedMatch>();
  const rejected = new Set<MeasurementKey>();
  for (const p of parses) {
    if (picked.has(p.key)) continue;
    if (!isInsideRange(p.key, p.cmEquivalent)) {
      rejected.add(p.key);
      continue;
    }
    picked.set(p.key, p);
  }
  // Remove rejected entries that ended up succeeding via a later parse.
  for (const k of picked.keys()) rejected.delete(k);
  return { picked, rejected };
};

/**
 * Extract measurement values from a free-form Japanese listing description.
 *
 * Designed to *never throw*; an unparseable input simply yields an empty
 * result with `confidence: 'low'`.
 */
export const extractMeasurementsFromText = (
  text: string,
  category: GarmentCategory,
): MeasurementExtractionResult => {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return {
      measurements: [],
      confidence: 'low',
      rawText: typeof text === 'string' ? text : '',
      unmatchedKeys: [],
    };
  }
  const expectedKeys = measurementKeysFor(category);
  const normalized = normalizeText(text);
  const parses = findAllParses(normalized, expectedKeys);
  const { picked, rejected } = pickBestPerKey(parses);

  const measurements: ExtractedMeasurement[] = [];
  for (const [, p] of picked) {
    measurements.push({
      key: p.key,
      value: p.unit === 'inch' ? Number(cmFromInch(p.rawValue).toFixed(1)) : p.rawValue,
      unit: p.unit === 'inch' ? 'cm' : p.unit,
    });
  }

  const expectedCount = expectedKeys.length;
  const matchedCount = picked.size;
  const ratio = expectedCount === 0 ? 0 : matchedCount / expectedCount;
  const allUnitsExplicit =
    matchedCount > 0 && Array.from(picked.values()).every((p) => p.unitExplicit);

  let confidence: ExtractionConfidence;
  if (matchedCount === 0) {
    confidence = 'low';
  } else if (ratio >= 0.7 && allUnitsExplicit) {
    confidence = 'high';
  } else if (ratio >= 0.3) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    measurements,
    confidence,
    rawText: text,
    unmatchedKeys: Array.from(rejected),
  };
};
