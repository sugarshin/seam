import { describe, expect, it } from 'vitest';
import { NG_RULE_PENALTY, SCORE_WEIGHTS } from '@seam/shared';
import { calculateCandidateScore } from './calculateCandidateScore';

const baseInput = {
  sizeScore: 0,
  priceScore: 0,
  conditionScore: 0,
  uniquenessScore: 0,
  duplicateRiskScore: 0,
  ruleViolations: [],
} as const;

describe('calculateCandidateScore', () => {
  it('handles all-zero inputs (duplicateInverse = 100 dominates)', () => {
    const out = calculateCandidateScore({ ...baseInput });
    // weighted = 100 * 0.15 = 15, no penalty.
    expect(out.breakdown.duplicateInverseScore).toBe(100);
    expect(out.breakdown.weightedTotal).toBeCloseTo(15, 5);
    expect(out.totalScore).toBe(15);
    expect(out.decision).toBe('skip');
    expect(out.breakdown.ngPenalty).toBe(0);
  });

  it('returns 100 + buy when all sub-scores are perfect and no duplicate', () => {
    const out = calculateCandidateScore({
      sizeScore: 100,
      priceScore: 100,
      conditionScore: 100,
      uniquenessScore: 100,
      duplicateRiskScore: 0,
      ruleViolations: [],
    });
    expect(out.breakdown.weightedTotal).toBeCloseTo(100, 5);
    expect(out.totalScore).toBe(100);
    expect(out.decision).toBe('buy');
  });

  it('respects all 5 weights', () => {
    const out = calculateCandidateScore({
      sizeScore: 80,
      priceScore: 60,
      conditionScore: 70,
      uniquenessScore: 50,
      duplicateRiskScore: 20,
      ruleViolations: [],
    });
    const expected =
      80 * SCORE_WEIGHTS.size +
      60 * SCORE_WEIGHTS.price +
      70 * SCORE_WEIGHTS.condition +
      50 * SCORE_WEIGHTS.uniqueness +
      80 * SCORE_WEIGHTS.duplicateInverse; // 100 - 20 = 80
    expect(out.breakdown.weightedTotal).toBeCloseTo(expected, 5);
    expect(out.totalScore).toBeCloseTo(expected, 5);
    expect(out.breakdown.duplicateInverseScore).toBe(80);
  });

  it('subtracts NG penalty after weighted average', () => {
    const out = calculateCandidateScore({
      sizeScore: 100,
      priceScore: 100,
      conditionScore: 100,
      uniquenessScore: 100,
      duplicateRiskScore: 0,
      ruleViolations: [{ severity: 'ng' }, { severity: 'warning' }],
    });
    const expectedPenalty = NG_RULE_PENALTY.ng + NG_RULE_PENALTY.warning; // 30
    expect(out.breakdown.ngPenalty).toBe(expectedPenalty);
    expect(out.totalScore).toBe(100 - expectedPenalty); // 70 → watch
    expect(out.decision).toBe('watch');
  });

  it('clamps inputs that are out of range', () => {
    const out = calculateCandidateScore({
      sizeScore: 9999,
      priceScore: -50,
      conditionScore: 200,
      uniquenessScore: -10,
      duplicateRiskScore: 250,
      ruleViolations: [],
    });
    expect(out.breakdown.sizeScore).toBe(100);
    expect(out.breakdown.priceScore).toBe(0);
    expect(out.breakdown.conditionScore).toBe(100);
    expect(out.breakdown.uniquenessScore).toBe(0);
    expect(out.breakdown.duplicateInverseScore).toBe(0); // 100 - clamp(250) = 100 - 100
    const expected =
      100 * SCORE_WEIGHTS.size +
      0 * SCORE_WEIGHTS.price +
      100 * SCORE_WEIGHTS.condition +
      0 * SCORE_WEIGHTS.uniqueness +
      0 * SCORE_WEIGHTS.duplicateInverse;
    expect(out.breakdown.weightedTotal).toBeCloseTo(expected, 5);
  });

  it('clamps total to [0, 100] when penalties exceed weighted total', () => {
    const out = calculateCandidateScore({
      sizeScore: 0,
      priceScore: 0,
      conditionScore: 0,
      uniquenessScore: 0,
      duplicateRiskScore: 100,
      ruleViolations: [{ severity: 'ng' }, { severity: 'ng' }, { severity: 'ng' }],
    });
    // weighted = 0, penalty = 60, clamp to 0.
    expect(out.totalScore).toBe(0);
    expect(out.decision).toBe('skip');
  });

  it('decides watch in the [60, 80) range', () => {
    const out = calculateCandidateScore({
      sizeScore: 70,
      priceScore: 70,
      conditionScore: 70,
      uniquenessScore: 70,
      duplicateRiskScore: 30,
      ruleViolations: [],
    });
    expect(out.totalScore).toBeGreaterThanOrEqual(60);
    expect(out.totalScore).toBeLessThan(80);
    expect(out.decision).toBe('watch');
  });

  it('handles empty ruleViolations as zero penalty', () => {
    const out = calculateCandidateScore({ ...baseInput, ruleViolations: [] });
    expect(out.breakdown.ngPenalty).toBe(0);
  });
});
