import { describe, expect, it } from 'vitest';
import { cmFromInch, inchFromCm, isComparableUnitPair, toCm } from './index';

describe('cmFromInch', () => {
  it('returns 2.54 for 1 inch', () => {
    expect(cmFromInch(1)).toBeCloseTo(2.54, 5);
  });

  it('returns 0 for 0 inch', () => {
    expect(cmFromInch(0)).toBe(0);
  });

  it('handles fractional inch', () => {
    expect(cmFromInch(0.5)).toBeCloseTo(1.27, 5);
  });
});

describe('inchFromCm', () => {
  it('returns 1 inch for 2.54 cm (round-trip)', () => {
    expect(inchFromCm(2.54)).toBeCloseTo(1, 5);
  });

  it('returns 0 for 0 cm', () => {
    expect(inchFromCm(0)).toBe(0);
  });

  it('round-trips with cmFromInch', () => {
    expect(inchFromCm(cmFromInch(7))).toBeCloseTo(7, 5);
  });
});

describe('toCm', () => {
  it('passes through cm', () => {
    expect(toCm(50, 'cm')).toBe(50);
  });

  it('converts inch to cm', () => {
    expect(toCm(10, 'inch')).toBeCloseTo(25.4, 5);
  });

  it('returns shoes sizes unchanged (no conversion table in v1)', () => {
    expect(toCm(27, 'jp')).toBe(27);
    expect(toCm(9, 'us')).toBe(9);
    expect(toCm(8, 'uk')).toBe(8);
    expect(toCm(42, 'eu')).toBe(42);
  });

  it('handles 0 length', () => {
    expect(toCm(0, 'cm')).toBe(0);
    expect(toCm(0, 'inch')).toBe(0);
  });
});

describe('isComparableUnitPair', () => {
  it('returns true for cm vs cm', () => {
    expect(isComparableUnitPair('cm', 'cm')).toBe(true);
  });

  it('returns true for cm vs inch (length pair)', () => {
    expect(isComparableUnitPair('cm', 'inch')).toBe(true);
    expect(isComparableUnitPair('inch', 'cm')).toBe(true);
  });

  it('returns true for matching shoes sizes', () => {
    expect(isComparableUnitPair('jp', 'jp')).toBe(true);
    expect(isComparableUnitPair('us', 'us')).toBe(true);
  });

  it('returns false for mismatched shoes sizes', () => {
    expect(isComparableUnitPair('jp', 'us')).toBe(false);
    expect(isComparableUnitPair('eu', 'uk')).toBe(false);
  });

  it('returns false for length vs shoes size', () => {
    expect(isComparableUnitPair('cm', 'jp')).toBe(false);
    expect(isComparableUnitPair('inch', 'us')).toBe(false);
  });
});
