import { CONDITION_RANK_SCORE, type ConditionRank } from '@seam/shared';

/**
 * Maps a condition rank to its 0-100 score. Returns the neutral 70 when no
 * rank is provided.
 */
export const calculateConditionScore = (rank?: ConditionRank): number => {
  if (rank === undefined) return 70;
  const score = CONDITION_RANK_SCORE[rank];
  return score ?? 70;
};
