import { COLOR_FAMILIES, type ColorFamily } from '@seam/shared';
import { normalizeText } from './text';

type Keyword = string | RegExp;

/** Katakana-isolated match so "タン" does not fire inside "ボタン" / "スタンド". */
const isolatedKatakana = (word: string): RegExp =>
  new RegExp(`(?:^|[^ァ-ヶー])${word}(?:[^ァ-ヶー]|$)`);

/**
 * Keywords per family, matched against NFKC + lowercased text. ASCII
 * keywords are word-bounded so "red" does not match "colored".
 */
const COLOR_KEYWORDS: Record<ColorFamily, readonly Keyword[]> = {
  black: ['ブラック', 'black', '黒', 'スミクロ', '墨'],
  white: [
    'ホワイト',
    'white',
    '白',
    'アイボリー',
    'ivory',
    '生成',
    'エクリュ',
    'ecru',
    'クリーム',
    'cream',
    'ナチュラル',
    'natural',
  ],
  gray: [
    'グレー',
    'グレイ',
    'gray',
    'grey',
    '灰',
    'チャコール',
    'charcoal',
    '杢',
    'ヘザー',
    'heather',
    'シルバー',
    'silver',
  ],
  navy: ['ネイビー', 'navy', '紺', 'ネイビーブルー', 'navy blue', 'ミッドナイト', 'midnight'],
  blue: [
    'ブルー',
    'blue',
    '青',
    '藍',
    'インディゴ',
    'indigo',
    'サックス',
    'sax',
    'ターコイズ',
    'turquoise',
  ],
  brown: [
    'ブラウン',
    'brown',
    '茶',
    'チョコ',
    'choco',
    'モカ',
    'mocha',
    'コーヒー',
    'テラコッタ',
    'terracotta',
  ],
  beige: [
    'ベージュ',
    'beige',
    'サンド',
    'sand',
    isolatedKatakana('タン'),
    'tan',
    'キャメル',
    'camel',
    'グレージュ',
    'トープ',
    'taupe',
    'オートミール',
    'oatmeal',
  ],
  khaki: ['カーキ', 'khaki', 'オリーブ', 'olive', 'オリーブドラブ', 'olive drab'],
  green: ['グリーン', 'green', '緑', 'ミント', 'mint', 'エメラルド', 'emerald'],
  red: [
    'レッド',
    'red',
    '赤',
    'ワイン',
    'wine',
    'ボルドー',
    'bordeaux',
    'バーガンディ',
    'burgundy',
    'マルーン',
    'maroon',
    '朱',
    'エンジ',
    'えんじ',
    '臙脂',
  ],
  pink: ['ピンク', 'pink', '桃', 'ローズ', 'rose', 'サーモン', 'salmon'],
  purple: [
    'パープル',
    'purple',
    '紫',
    'ラベンダー',
    'lavender',
    'バイオレット',
    'violet',
    'プラム',
    'plum',
  ],
  yellow: [
    'イエロー',
    'yellow',
    '黄',
    'マスタード',
    'mustard',
    'ゴールド',
    'gold',
    'からし',
    'カラシ',
    'レモン',
    'lemon',
  ],
  orange: ['オレンジ', 'orange', '橙'],
  multi: [
    'マルチ',
    'multi',
    '柄',
    'チェック',
    'check',
    'plaid',
    'タータン',
    'tartan',
    'ストライプ',
    'stripe',
    'ボーダー',
    'border',
    '迷彩',
    'カモ',
    'camo',
    'ペイズリー',
    'paisley',
    'ドット',
    'dot',
    'クレイジー',
    'crazy',
  ],
};

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toRegExp = (kw: Keyword): RegExp => {
  if (kw instanceof RegExp) return new RegExp(kw.source, 'g');
  if (/^[a-z ]+$/.test(kw)) return new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'g');
  return new RegExp(escapeRegExp(kw), 'g');
};

const COMPILED: readonly { family: ColorFamily; re: RegExp }[] = COLOR_FAMILIES.flatMap((family) =>
  COLOR_KEYWORDS[family].map((kw) => ({ family, re: toRegExp(kw) })),
);

/** Explicit two-tone notation: "白/黒", "ネイビー×ホワイト", "black x white". */
const SEPARATOR_RE = /[/／×✕・&＆,、+＋]| x /;

type Match = { family: ColorFamily; end: number; length: number };

const lastMatch = (text: string, re: RegExp): { end: number; length: number } | null => {
  re.lastIndex = 0;
  let found: { end: number; length: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found = { end: m.index + m[0].length, length: m[0].length };
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return found;
};

/**
 * Map a free-text color ("ダークネイビー", "オフホワイト", "Olive Drab", "杢グレー")
 * to a `ColorFamily`. Returns null when blank or no keyword is recognized.
 *
 * Rules:
 *   - Any pattern keyword (柄 / チェック / ストライプ …) → `multi`.
 *   - Two or more families joined by a separator ("白/黒") → `multi`.
 *   - Otherwise the keyword that ends last wins, because Japanese / English
 *     compound color names put the head color last ("ライトブルー", "ブルーグレー",
 *     "light blue"). Ties go to the longer keyword ("ネイビーブルー" → navy).
 */
export const normalizeColor = (raw: string | undefined | null): ColorFamily | null => {
  if (raw === undefined || raw === null) return null;
  const text = normalizeText(raw);
  if (text === '') return null;

  const matches: Match[] = [];
  for (const { family, re } of COMPILED) {
    const m = lastMatch(text, re);
    if (m) matches.push({ family, ...m });
  }
  if (matches.length === 0) return null;
  if (matches.some((m) => m.family === 'multi')) return 'multi';

  const families = new Set(matches.map((m) => m.family));
  if (families.size >= 2 && SEPARATOR_RE.test(text)) return 'multi';

  matches.sort((a, b) => b.end - a.end || b.length - a.length);
  return matches[0]?.family ?? null;
};
