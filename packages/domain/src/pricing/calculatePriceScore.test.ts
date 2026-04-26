import { describe, it, expect } from 'vitest';
import { calculatePriceScore } from './calculatePriceScore';

describe('calculatePriceScore', () => {
  it('returns 100 when totalPrice is at or below easyBuyPrice', () => {
    expect(
      calculatePriceScore({
        totalPrice: 1000,
        easyBuyPrice: 1000,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(100);
    expect(
      calculatePriceScore({
        totalPrice: 500,
        easyBuyPrice: 1000,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(100);
  });

  it('returns 80 when totalPrice is between easyBuyPrice and acceptablePrice', () => {
    expect(
      calculatePriceScore({
        totalPrice: 1500,
        easyBuyPrice: 1000,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(80);
    // exactly at acceptable boundary still 80
    expect(
      calculatePriceScore({
        totalPrice: 2000,
        easyBuyPrice: 1000,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(80);
  });

  it('returns 50 when totalPrice is between acceptablePrice and maxBidPrice', () => {
    expect(
      calculatePriceScore({
        totalPrice: 2500,
        easyBuyPrice: 1000,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(50);
    // exactly at max boundary still 50
    expect(
      calculatePriceScore({
        totalPrice: 3000,
        easyBuyPrice: 1000,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(50);
  });

  it('returns 0 when totalPrice exceeds maxBidPrice', () => {
    expect(
      calculatePriceScore({
        totalPrice: 3001,
        easyBuyPrice: 1000,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(0);
  });

  it('returns neutral 50 when totalPrice is undefined', () => {
    expect(
      calculatePriceScore({
        easyBuyPrice: 1000,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(50);
  });

  it('returns neutral 50 when no thresholds are set', () => {
    expect(calculatePriceScore({ totalPrice: 1500 })).toBe(50);
    expect(calculatePriceScore({})).toBe(50);
  });

  it('collapses bands when only some thresholds are set', () => {
    // only easy defined: <= easy → 100, otherwise 0
    expect(calculatePriceScore({ totalPrice: 800, easyBuyPrice: 1000 })).toBe(100);
    expect(calculatePriceScore({ totalPrice: 1200, easyBuyPrice: 1000 })).toBe(0);
    // only acceptable defined
    expect(calculatePriceScore({ totalPrice: 1500, acceptablePrice: 2000 })).toBe(80);
    expect(calculatePriceScore({ totalPrice: 2500, acceptablePrice: 2000 })).toBe(0);
    // only max defined
    expect(calculatePriceScore({ totalPrice: 2500, maxBidPrice: 3000 })).toBe(50);
    expect(calculatePriceScore({ totalPrice: 3500, maxBidPrice: 3000 })).toBe(0);
  });

  it('treats NaN/Infinity thresholds as undefined', () => {
    expect(
      calculatePriceScore({
        totalPrice: 1500,
        easyBuyPrice: Number.NaN,
        acceptablePrice: 2000,
        maxBidPrice: 3000,
      }),
    ).toBe(80);
  });
});
