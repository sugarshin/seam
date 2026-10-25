/**
 * Display buckets for the Analytics screen. Color / material are stored as
 * free text, so the domain layer (`@seam/domain/analytics`) normalizes them
 * into these families before aggregating.
 */

export const COLOR_FAMILIES = [
  'black',
  'white',
  'gray',
  'navy',
  'blue',
  'brown',
  'beige',
  'khaki',
  'green',
  'red',
  'pink',
  'purple',
  'yellow',
  'orange',
  'multi',
] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];

export const COLOR_FAMILY_LABEL: Record<ColorFamily, string> = {
  black: 'ブラック',
  white: 'ホワイト',
  gray: 'グレー',
  navy: 'ネイビー',
  blue: 'ブルー',
  brown: 'ブラウン',
  beige: 'ベージュ',
  khaki: 'カーキ',
  green: 'グリーン',
  red: 'レッド',
  pink: 'ピンク',
  purple: 'パープル',
  yellow: 'イエロー',
  orange: 'オレンジ',
  multi: 'マルチ・柄',
};

/** Representative swatch per family. `multi` has no single color. */
export const COLOR_FAMILY_SWATCH: Record<ColorFamily, string | null> = {
  black: '#1A1A1A',
  white: '#F5F3EE',
  gray: '#8E8E8E',
  navy: '#1F2A44',
  blue: '#3A6EA5',
  brown: '#6B4A2B',
  beige: '#D8C3A0',
  khaki: '#77744A',
  green: '#3F7A4A',
  red: '#B23A3A',
  pink: '#E3A1B5',
  purple: '#6E4C8E',
  yellow: '#E2C044',
  orange: '#D9813A',
  multi: null,
};

export const MATERIAL_FAMILIES = [
  'cotton',
  'wool',
  'cashmere',
  'linen',
  'silk',
  'polyester',
  'nylon',
  'acrylic',
  'rayon',
  'leather',
  'suede',
] as const;

export type MaterialFamily = (typeof MATERIAL_FAMILIES)[number];

export const MATERIAL_FAMILY_LABEL: Record<MaterialFamily, string> = {
  cotton: 'コットン',
  wool: 'ウール',
  cashmere: 'カシミヤ',
  linen: 'リネン・麻',
  silk: 'シルク',
  polyester: 'ポリエステル',
  nylon: 'ナイロン',
  acrylic: 'アクリル',
  rayon: 'レーヨン',
  leather: 'レザー',
  suede: 'スエード',
};

export type PriceBand = {
  /** Inclusive lower bound (JPY). */
  min: number;
  /** Exclusive upper bound (JPY). `null` = open-ended. */
  max: number | null;
  label: string;
};

export const PRICE_BANDS: readonly PriceBand[] = [
  { min: 0, max: 3000, label: '〜3千円' },
  { min: 3000, max: 5000, label: '3千〜5千円' },
  { min: 5000, max: 10000, label: '5千〜1万円' },
  { min: 10000, max: 20000, label: '1万〜2万円' },
  { min: 20000, max: 30000, label: '2万〜3万円' },
  { min: 30000, max: 50000, label: '3万〜5万円' },
  { min: 50000, max: null, label: '5万円〜' },
];
