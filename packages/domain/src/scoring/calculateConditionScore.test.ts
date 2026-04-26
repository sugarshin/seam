import { describe, it, expect } from 'vitest';
import { CONDITION_RANK_SCORE } from '@seam/shared';
import { calculateConditionScore } from './calculateConditionScore';

describe('calculateConditionScore', () => {
  it('returns 100 for S rank', () => {
    expect(calculateConditionScore('S')).toBe(CONDITION_RANK_SCORE.S);
    expect(calculateConditionScore('S')).toBe(100);
  });

  it('returns the score for A rank', () => {
    expect(calculateConditionScore('A')).toBe(CONDITION_RANK_SCORE.A);
    expect(calculateConditionScore('A')).toBe(85);
  });

  it('returns the score for B rank (mid)', () => {
    expect(calculateConditionScore('B')).toBe(70);
  });

  it('returns the score for C rank', () => {
    expect(calculateConditionScore('C')).toBe(50);
  });

  it('returns the score for D rank (lowest)', () => {
    expect(calculateConditionScore('D')).toBe(25);
  });

  it('returns neutral 70 when rank is undefined', () => {
    expect(calculateConditionScore(undefined)).toBe(70);
    expect(calculateConditionScore()).toBe(70);
  });
});
