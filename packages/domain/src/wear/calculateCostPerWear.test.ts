import { describe, expect, it } from 'vitest';
import { calculateCostPerWear } from './calculateCostPerWear';

describe('calculateCostPerWear', () => {
  it('returns null when totalPrice is undefined', () => {
    expect(calculateCostPerWear(undefined, 5)).toBeNull();
  });

  it('returns null when wearCount is undefined', () => {
    expect(calculateCostPerWear(10000, undefined)).toBeNull();
  });

  it('returns null when wearCount is 0 (avoid Infinity)', () => {
    expect(calculateCostPerWear(10000, 0)).toBeNull();
  });

  it('divides totalPrice by wearCount', () => {
    expect(calculateCostPerWear(10000, 5)).toBe(2000);
  });

  it('keeps fractional results as floats', () => {
    expect(calculateCostPerWear(1000, 3)).toBeCloseTo(333.333, 3);
  });

  it('treats negative totalPrice as 0', () => {
    expect(calculateCostPerWear(-500, 5)).toBe(0);
  });

  it('treats negative wearCount as 0 (which then yields null)', () => {
    expect(calculateCostPerWear(1000, -3)).toBeNull();
  });

  it('returns null when totalPrice is NaN', () => {
    expect(calculateCostPerWear(Number.NaN, 5)).toBeNull();
  });

  it('returns null when wearCount is +Infinity', () => {
    expect(calculateCostPerWear(1000, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('handles 0 totalPrice and positive wearCount', () => {
    expect(calculateCostPerWear(0, 4)).toBe(0);
  });
});
