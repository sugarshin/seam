import { MATERIAL_FAMILIES, type MaterialFamily } from '@seam/shared';
import { normalizeText } from './text';

/**
 * Keywords per family, matched against NFKC + lowercased text. Fabric names
 * that imply a fiber (デニム, コーデュロイ, ツイード …) map to that fiber.
 */
const MATERIAL_KEYWORDS: Record<MaterialFamily, readonly string[]> = {
  cotton: [
    'コットン',
    'cotton',
    '綿',
    'デニム',
    'denim',
    'キャンバス',
    'canvas',
    'コーデュロイ',
    'corduroy',
    'シャンブレー',
    'chambray',
    'オックスフォード',
    'oxford',
  ],
  wool: [
    'ウール',
    'wool',
    '毛',
    'モヘア',
    'mohair',
    'アルパカ',
    'alpaca',
    'アンゴラ',
    'angora',
    'メリノ',
    'merino',
    'ツイード',
    'tweed',
    'メルトン',
    'melton',
  ],
  cashmere: ['カシミヤ', 'カシミア', 'cashmere'],
  linen: ['リネン', 'linen', '麻', 'ヘンプ', 'hemp', 'ラミー', 'ramie'],
  silk: ['シルク', 'silk', '絹'],
  polyester: ['ポリエステル', 'polyester', 'フリース', 'fleece'],
  nylon: ['ナイロン', 'nylon'],
  acrylic: ['アクリル', 'acrylic'],
  rayon: [
    'レーヨン',
    'rayon',
    'キュプラ',
    'cupra',
    'テンセル',
    'tencel',
    'リヨセル',
    'lyocell',
    'モダール',
    'modal',
  ],
  leather: [
    'レザー',
    'leather',
    '革',
    'カウハイド',
    'cowhide',
    'ホースハイド',
    'horsehide',
    'ディアスキン',
    'deerskin',
  ],
  suede: ['スエード', 'スウェード', 'suede', 'ヌバック', 'nubuck'],
};

/**
 * Words containing a fiber character that do not describe the shell fabric:
 * 中綿 (filling), 起毛 (brushed finish), 毛羽 (fuzz).
 */
const NOISE_RE = /中綿|起毛|毛羽/g;

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COMPILED: readonly { family: MaterialFamily; re: RegExp }[] = MATERIAL_FAMILIES.flatMap(
  (family) =>
    MATERIAL_KEYWORDS[family].map((kw) => ({
      family,
      re: /^[a-z]+$/.test(kw)
        ? new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'g')
        : new RegExp(escapeRegExp(kw), 'g'),
    })),
);

const PERCENT_AFTER_RE = /^\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%/;
const PERCENT_BEFORE_RE = /(\d+(?:\.\d+)?)\s*%\s*$/;

/**
 * Map a free-text material ("コットン 100%", "綿", "ウール80% ナイロン20%",
 * "表地: ナイロン100% 中綿: ダウン90%") to its primary `MaterialFamily`.
 *
 * The family with the highest stated percentage wins; ties and
 * percentage-less text fall back to the earliest mention (labels usually list
 * the main fiber / the shell first). Returns null when blank or unrecognized.
 */
export const normalizeMaterial = (raw: string | undefined | null): MaterialFamily | null => {
  if (raw === undefined || raw === null) return null;
  const text = normalizeText(raw).replace(NOISE_RE, ' ');
  if (text.trim() === '') return null;

  const matches: { family: MaterialFamily; index: number; after?: number; before?: number }[] = [];
  for (const { family, re } of COMPILED) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const after = PERCENT_AFTER_RE.exec(text.slice(m.index + m[0].length))?.[1];
      const before = PERCENT_BEFORE_RE.exec(text.slice(0, m.index))?.[1];
      matches.push({
        family,
        index: m.index,
        after: after === undefined ? undefined : Number(after),
        before: before === undefined ? undefined : Number(before),
      });
    }
  }

  // Labels are either "綿100%" or "100%綿" style. Decide once per text so a
  // trailing "…100% ポリエステル" is not read as polyester's percentage.
  const percentAfter = matches.some((m) => m.after !== undefined);
  let winner: { family: MaterialFamily; percent: number; index: number } | null = null;
  for (const m of matches) {
    const percent = (percentAfter ? m.after : m.before) ?? 0;
    if (
      !winner ||
      percent > winner.percent ||
      (percent === winner.percent && m.index < winner.index)
    ) {
      winner = { family: m.family, percent, index: m.index };
    }
  }
  return winner?.family ?? null;
};
