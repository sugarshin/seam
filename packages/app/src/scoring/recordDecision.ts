import type { ItemStatus, ScoreDecision } from '@seam/shared';
import {
  candidateInfoRepository,
  decisionLogRepository,
  evaluationRepository,
  itemRepository,
} from '../repositories';
import type { ComputeCandidateScoreResult } from './computeCandidateScore';

export type RecordDecisionInput = {
  itemId: string;
  decision: ScoreDecision;
  reason: string;
  /** When provided, persists a CandidateEvaluation snapshot too. */
  score?: ComputeCandidateScoreResult;
  /** Optional price-at-decision (yen) for the DecisionLog row. */
  priceAtDecision?: number;
};

const STATUS_FOR_DECISION: Record<ScoreDecision, ItemStatus> = {
  buy: 'owned',
  watch: 'watching',
  skip: 'skipped',
};

/**
 * Persist a Buy / Watch / Skip judgment:
 *
 *   1. Insert a DecisionLog row (always).
 *   2. If a {@link ComputeCandidateScoreResult} is provided, snapshot it as a
 *      CandidateEvaluation row so we keep an audit trail of the score that
 *      drove the decision.
 *   3. Move the item to the matching status:
 *        - buy   → owned   (and drop the candidate-info row)
 *        - watch → watching
 *        - skip  → skipped
 */
export const recordDecision = async (input: RecordDecisionInput): Promise<void> => {
  await decisionLogRepository.create({
    itemId: input.itemId,
    decision: input.decision,
    reason: input.reason,
    priceAtDecision: input.priceAtDecision,
  });

  if (input.score) {
    await evaluationRepository.create({
      itemId: input.itemId,
      sizeScore: Math.round(input.score.breakdown.sizeScore),
      priceScore: Math.round(input.score.breakdown.priceScore),
      conditionScore: Math.round(input.score.breakdown.conditionScore),
      uniquenessScore: Math.round(input.score.breakdown.uniquenessScore),
      duplicateRiskScore: Math.round(100 - input.score.breakdown.duplicateInverseScore),
      totalScore: Math.round(input.score.totalScore),
      decision: input.decision,
      reason: input.reason,
    });
  }

  const nextStatus = STATUS_FOR_DECISION[input.decision];
  await itemRepository.setStatus(input.itemId, nextStatus);

  if (input.decision === 'buy') {
    await candidateInfoRepository.deleteByItemId(input.itemId);
  }
};
