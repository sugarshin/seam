import { describe, it, expect } from 'vitest';
import { calculateTotalPrice } from './calculateTotalPrice';

describe('calculateTotalPrice', () => {
  it('sums price and shipping fee when both provided', () => {
    expect(calculateTotalPrice(1000, 500)).toBe(1500);
  });

  it('treats missing shipping fee as zero', () => {
    expect(calculateTotalPrice(1000, undefined)).toBe(1000);
  });

  it('treats missing price as zero', () => {
    expect(calculateTotalPrice(undefined, 500)).toBe(500);
  });

  it('returns 0 when both are undefined', () => {
    expect(calculateTotalPrice(undefined, undefined)).toBe(0);
  });

  it('returns 0 when called with no arguments', () => {
    expect(calculateTotalPrice()).toBe(0);
  });

  it('treats non-finite values (NaN/Infinity) as zero', () => {
    expect(calculateTotalPrice(Number.NaN, 500)).toBe(500);
    expect(calculateTotalPrice(1000, Number.POSITIVE_INFINITY)).toBe(1000);
  });

  it('handles zero values explicitly', () => {
    expect(calculateTotalPrice(0, 0)).toBe(0);
    expect(calculateTotalPrice(0, 100)).toBe(100);
  });
});
