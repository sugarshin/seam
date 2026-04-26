import type { ConditionRank } from '@seam/shared';
import {
  calculateCandidateScore,
  calculateConditionScore,
  calculateDuplicateRisk,
  calculatePriceScore,
  calculateSizeScore,
  calculateUniquenessScore,
  evaluatePersonalMeasurementRules,
  type CandidateScoreOutput,
  type RuleViolation,
  type SizeScoreAnchor,
} from '@seam/domain';
import {
  candidateInfoRepository,
  fitAnchorRepository,
  itemRepository,
  measurementRepository,
  measurementRuleRepository,
} from '../repositories';

export type ComputeCandidateScoreResult = CandidateScoreOutput & {
  ruleViolations: RuleViolation[];
  comparedAnchorIds: string[];
};

/**
 * Pulls together all the inputs for {@link calculateCandidateScore} from the
 * repositories and returns the unified score for a candidate item.
 *
 * Inputs gathered:
 *   - candidate item, its measurements, its candidate sale info
 *   - fit anchors of the same category (with their items + measurements)
 *   - all owned items (for uniqueness / duplicate scoring)
 *   - personal measurement rules of the same category
 *
 * No persistence — callers decide whether to write a CandidateEvaluation row.
 */
export const computeCandidateScore = async (
  itemId: string,
): Promise<ComputeCandidateScoreResult> => {
  const candidate = await itemRepository.getById(itemId);
  if (!candidate) {
    throw new Error(`Item not found: ${itemId}`);
  }

  const [candidateMeasurements, candidateInfo, anchorRows, ownedItems, rules] =
    await Promise.all([
      measurementRepository.listByItem(itemId),
      candidateInfoRepository.getByItemId(itemId),
      fitAnchorRepository.listByCategory(candidate.category),
      itemRepository.listOwned(),
      measurementRuleRepository.listByCategory(candidate.category),
    ]);

  // Hydrate anchors → SizeScoreAnchor[]
  const anchors: SizeScoreAnchor[] = [];
  const comparedAnchorIds: string[] = [];
  for (const a of anchorRows) {
    // eslint-disable-next-line no-await-in-loop
    const [aItem, aMs] = await Promise.all([
      itemRepository.getById(a.itemId),
      measurementRepository.listByItem(a.itemId),
    ]);
    if (aItem) {
      anchors.push({ item: aItem, measurements: aMs });
      comparedAnchorIds.push(a.id);
    }
  }

  const sizeScore = calculateSizeScore(candidate, candidateMeasurements, anchors);
  const priceScore = calculatePriceScore({
    totalPrice: candidateInfo?.totalPrice,
    easyBuyPrice: candidateInfo?.easyBuyPrice,
    acceptablePrice: candidateInfo?.acceptablePrice,
    maxBidPrice: candidateInfo?.maxBidPrice,
  });
  const conditionScore = calculateConditionScore(
    candidate.conditionRank as ConditionRank | undefined,
  );
  const uniquenessScore = calculateUniquenessScore(candidate, ownedItems);
  const duplicateRiskScore = calculateDuplicateRisk(candidate, ownedItems);

  const ruleViolations = evaluatePersonalMeasurementRules(
    candidateMeasurements,
    rules,
    candidate.category,
  );

  const score = calculateCandidateScore({
    sizeScore,
    priceScore,
    conditionScore,
    uniquenessScore,
    duplicateRiskScore,
    ruleViolations,
  });

  return {
    ...score,
    ruleViolations,
    comparedAnchorIds,
  };
};
