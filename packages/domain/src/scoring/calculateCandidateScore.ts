import {
  NG_RULE_PENALTY,
  SCORE_WEIGHTS,
  decisionFromTotal,
  type ScoreDecision,
} from '@seam/shared';

const MIN = 0;
const MAX = 100;

const clamp = (n: number): number => Math.max(MIN, Math.min(MAX, n));

export type CandidateScoreInput = {
  sizeScore: number;
  priceScore: number;
  conditionScore: number;
  uniquenessScore: number;
  duplicateRiskScore: number;
  ruleViolations: ReadonlyArray<{ severity: 'warning' | 'ng' }>;
};

export type CandidateScoreBreakdown = {
  sizeScore: number;
  priceScore: number;
  conditionScore: number;
  uniquenessScore: number;
  duplicateInverseScore: number;
  /** Weighted average BEFORE the NG penalty subtraction. */
  weightedTotal: number;
  /** Total NG / warning penalty applied (>= 0). */
  ngPenalty: number;
};

export type CandidateScoreOutput = {
  totalScore: number;
  decision: ScoreDecision;
  breakdown: CandidateScoreBreakdown;
};

/**
 * Combine the 5 sub-scores (size, price, condition, uniqueness, duplicate) into
 * a final 0-100 score and a buy / watch / skip decision.
 *
 * - duplicateRiskScore is inverted (100 - x) before mixing because higher risk
 *   should pull the total DOWN.
 * - ruleViolations contribute a flat post-mix penalty: 10 per warning, 20 per
 *   NG (see {@link NG_RULE_PENALTY}).
 * - All inputs are clamped to [0, 100] defensively so callers may pass
 *   unsanitised heuristics without breaking the math.
 */
export const calculateCandidateScore = (input: CandidateScoreInput): CandidateScoreOutput => {
  const sizeScore = clamp(input.sizeScore);
  const priceScore = clamp(input.priceScore);
  const conditionScore = clamp(input.conditionScore);
  const uniquenessScore = clamp(input.uniquenessScore);
  const duplicateRiskScore = clamp(input.duplicateRiskScore);
  const duplicateInverseScore = MAX - duplicateRiskScore;

  const weightedTotal =
    sizeScore * SCORE_WEIGHTS.size +
    priceScore * SCORE_WEIGHTS.price +
    conditionScore * SCORE_WEIGHTS.condition +
    uniquenessScore * SCORE_WEIGHTS.uniqueness +
    duplicateInverseScore * SCORE_WEIGHTS.duplicateInverse;

  let ngPenalty = 0;
  for (const v of input.ruleViolations) {
    ngPenalty += NG_RULE_PENALTY[v.severity];
  }

  const totalScore = clamp(weightedTotal - ngPenalty);
  const decision = decisionFromTotal(totalScore);

  return {
    totalScore,
    decision,
    breakdown: {
      sizeScore,
      priceScore,
      conditionScore,
      uniquenessScore,
      duplicateInverseScore,
      weightedTotal,
      ngPenalty,
    },
  };
};
