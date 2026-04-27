import { describe, expect, it } from 'vitest';
import type { GarmentItem, SaleInfo } from '@seam/shared';
import {
  compareSoldByNetCpwAsc,
  compareSoldByRecoveryRateDesc,
  computeRecoveryRate,
  passesRecoveryRateBounds,
  type SoldItem,
} from './soldHelpers';

const baseSold = (overrides: Partial<SoldItem>): SoldItem => {
  const item: GarmentItem = {
    id: overrides.id ?? 'i',
    status: 'sold',
    name: overrides.name ?? 'name',
    category: overrides.category ?? 'shirt',
    isFitAnchor: false,
    isSellCandidate: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as GarmentItem;
  const saleInfo: SaleInfo = overrides.saleInfo ?? { itemId: item.id };
  return {
    ...item,
    saleInfo,
    recoveryRate: overrides.recoveryRate,
    netCpw: overrides.netCpw ?? null,
    wearCount: overrides.wearCount ?? 0,
  };
};

describe('compareSoldByRecoveryRateDesc', () => {
  it('sorts higher recovery rate first', () => {
    const items = [
      baseSold({ id: 'low', recoveryRate: 0.3 }),
      baseSold({ id: 'high', recoveryRate: 0.9 }),
      baseSold({ id: 'mid', recoveryRate: 0.6 }),
    ];
    items.sort(compareSoldByRecoveryRateDesc);
    expect(items.map((i) => i.id)).toEqual(['high', 'mid', 'low']);
  });

  it('places undefined recovery rate at the end', () => {
    const items = [
      baseSold({ id: 'undef', recoveryRate: undefined }),
      baseSold({ id: 'mid', recoveryRate: 0.5 }),
      baseSold({ id: 'high', recoveryRate: 0.9 }),
    ];
    items.sort(compareSoldByRecoveryRateDesc);
    expect(items.map((i) => i.id)).toEqual(['high', 'mid', 'undef']);
  });

  it('treats two undefined as equal', () => {
    const a = baseSold({ id: 'a', recoveryRate: undefined });
    const b = baseSold({ id: 'b', recoveryRate: undefined });
    expect(compareSoldByRecoveryRateDesc(a, b)).toBe(0);
  });
});

describe('compareSoldByNetCpwAsc', () => {
  it('sorts smaller netCpw first (= better deal)', () => {
    const items = [
      baseSold({ id: 'expensive', netCpw: 5000 }),
      baseSold({ id: 'cheap', netCpw: 100 }),
      baseSold({ id: 'mid', netCpw: 1500 }),
    ];
    items.sort(compareSoldByNetCpwAsc);
    expect(items.map((i) => i.id)).toEqual(['cheap', 'mid', 'expensive']);
  });

  it('places null netCpw at the end', () => {
    const items = [
      baseSold({ id: 'null', netCpw: null }),
      baseSold({ id: 'cheap', netCpw: 100 }),
      baseSold({ id: 'mid', netCpw: 1500 }),
    ];
    items.sort(compareSoldByNetCpwAsc);
    expect(items.map((i) => i.id)).toEqual(['cheap', 'mid', 'null']);
  });

  it('handles negative netCpw (profit per wear) as best', () => {
    const items = [
      baseSold({ id: 'normal', netCpw: 500 }),
      baseSold({ id: 'profit', netCpw: -200 }),
    ];
    items.sort(compareSoldByNetCpwAsc);
    expect(items.map((i) => i.id)).toEqual(['profit', 'normal']);
  });
});

describe('computeRecoveryRate', () => {
  it('returns soldPrice / totalPrice', () => {
    expect(computeRecoveryRate(8000, 10000)).toBeCloseTo(0.8);
  });

  it('returns undefined when soldPrice is missing', () => {
    expect(computeRecoveryRate(undefined, 10000)).toBeUndefined();
  });

  it('returns undefined when totalPrice is missing or non-positive', () => {
    expect(computeRecoveryRate(5000, undefined)).toBeUndefined();
    expect(computeRecoveryRate(5000, 0)).toBeUndefined();
    expect(computeRecoveryRate(5000, -100)).toBeUndefined();
  });

  it('handles soldPrice > totalPrice (rate > 1) without clamping', () => {
    expect(computeRecoveryRate(12000, 10000)).toBeCloseTo(1.2);
  });
});

describe('passesRecoveryRateBounds', () => {
  it('passes when no bounds are set', () => {
    expect(passesRecoveryRateBounds({ recoveryRate: undefined })).toBe(true);
    expect(passesRecoveryRateBounds({ recoveryRate: 0.5 })).toBe(true);
  });

  it('rejects undefined recovery rate when any bound is set', () => {
    expect(passesRecoveryRateBounds({ recoveryRate: undefined }, 0.3)).toBe(false);
    expect(passesRecoveryRateBounds({ recoveryRate: undefined }, undefined, 0.8)).toBe(false);
  });

  it('applies inclusive lower bound', () => {
    expect(passesRecoveryRateBounds({ recoveryRate: 0.5 }, 0.5)).toBe(true);
    expect(passesRecoveryRateBounds({ recoveryRate: 0.49 }, 0.5)).toBe(false);
  });

  it('applies inclusive upper bound', () => {
    expect(passesRecoveryRateBounds({ recoveryRate: 0.8 }, undefined, 0.8)).toBe(true);
    expect(passesRecoveryRateBounds({ recoveryRate: 0.81 }, undefined, 0.8)).toBe(false);
  });

  it('combines both bounds', () => {
    expect(passesRecoveryRateBounds({ recoveryRate: 0.6 }, 0.5, 0.8)).toBe(true);
    expect(passesRecoveryRateBounds({ recoveryRate: 0.4 }, 0.5, 0.8)).toBe(false);
    expect(passesRecoveryRateBounds({ recoveryRate: 0.9 }, 0.5, 0.8)).toBe(false);
  });
});
