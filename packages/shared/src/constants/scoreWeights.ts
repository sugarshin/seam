/**
 * Buy Judgment Score - 5 factor weighted average (0-100).
 *
 * total = sum(factor_i * weight_i) where factor_i ∈ [0, 100], sum(weight_i) = 1.
 *
 * For duplicateRiskScore: HIGHER risk is BAD, so we invert (100 - risk) before mixing.
 */
export const SCORE_WEIGHTS = {
  size: 0.35,
  price: 0.25,
  condition: 0.15,
  uniqueness: 0.1,
  duplicateInverse: 0.15,
} as const;

export const SCORE_DECISION_THRESHOLDS = {
  buy: 80,
  watch: 60,
} as const;

/**
 * Personal NG Rule penalties applied AFTER weighted average.
 */
export const NG_RULE_PENALTY = {
  warning: 10,
  ng: 20,
} as const;

export type ScoreDecision = 'buy' | 'watch' | 'skip';

export const decisionFromTotal = (total: number): ScoreDecision => {
  if (total >= SCORE_DECISION_THRESHOLDS.buy) return 'buy';
  if (total >= SCORE_DECISION_THRESHOLDS.watch) return 'watch';
  return 'skip';
};

/**
 * Map condition rank S/A/B/C/D to a 0-100 score.
 */
export const CONDITION_RANK_SCORE: Record<'S' | 'A' | 'B' | 'C' | 'D', number> = {
  S: 100,
  A: 85,
  B: 70,
  C: 50,
  D: 25,
};

export type ConditionRank = keyof typeof CONDITION_RANK_SCORE;
export const CONDITION_RANKS: readonly ConditionRank[] = ['S', 'A', 'B', 'C', 'D'];

/**
 * 古着 / 中古品業界 (ヤフオク・メルカリ・Grailed 等) の標準的な
 * コンディション区分を踏まえた表示ラベル。
 */
export const CONDITION_RANK_LABEL: Record<ConditionRank, string> = {
  S: '新品・未使用',
  A: '美品',
  B: '良好',
  C: 'やや使用感あり',
  D: '難あり',
};

/**
 * コンディションを判定するときの目安。Picker の補助テキストとして表示する。
 * 業界標準の中古コンディション基準を簡略化した内容。
 */
export const CONDITION_RANK_DESCRIPTION: Record<ConditionRank, string> = {
  S: 'タグ付き / デッドストック。一度も着用していない',
  A: '着用数回程度。目立つ汚れ・ダメージなし、新品に近い状態',
  B: '通常の使用感あり。目立つダメージなし、軽微な使用痕のみ',
  C: '使用感がはっきり。小さなシミ・色あせ・ほつれなど軽微なダメージあり',
  D: '目立つダメージあり (破れ・大きなシミ・色あせ・リペア跡)。ジャンク扱い',
};
