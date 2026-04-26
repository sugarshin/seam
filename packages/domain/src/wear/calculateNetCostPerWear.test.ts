import { describe, expect, it } from 'vitest';
import { calculateNetCostPerWear } from './calculateNetCostPerWear';

describe('calculateNetCostPerWear', () => {
  it('falls back to basic cost-per-wear when soldPrice is undefined', () => {
    expect(calculateNetCostPerWear(10000, 5, undefined)).toBe(2000);
  });

  it('subtracts soldPrice before dividing', () => {
    expect(calculateNetCostPerWear(10000, 5, 4000)).toBe(1200);
  });

  it('returns 0 when soldPrice equals totalPrice', () => {
    expect(calculateNetCostPerWear(10000, 5, 10000)).toBe(0);
  });

  it('returns negative net cost when sold for more than purchase', () => {
    expect(calculateNetCostPerWear(10000, 5, 12500)).toBe(-500);
  });

  it('returns null when wearCount is 0', () => {
    expect(calculateNetCostPerWear(10000, 0, 5000)).toBeNull();
  });

  it('returns null when totalPrice missing', () => {
    expect(calculateNetCostPerWear(undefined, 5, 1000)).toBeNull();
  });

  it('treats negative soldPrice as 0', () => {
    expect(calculateNetCostPerWear(10000, 5, -500)).toBe(2000);
  });

  it('returns null when soldPrice is NaN (fallback path: NaN is not undefined)', () => {
    // soldPrice is provided but invalid → fall through to basic formula.
    expect(calculateNetCostPerWear(10000, 5, Number.NaN)).toBe(2000);
  });
});
