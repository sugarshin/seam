import { describe, expect, it } from 'vitest';
import { crossTabulate, distributionBy } from './distribution';
import { priceBandDistribution, priceBandOf } from './priceBands';

type Row = { key?: string; col?: string; totalPrice?: number; purchasePrice?: number };

describe('distributionBy', () => {
  const rows: Row[] = [
    { key: 'a', totalPrice: 1000 },
    { key: 'b', totalPrice: 5000 },
    { key: 'a', purchasePrice: 2000 },
    { key: undefined },
    { key: 'c' },
  ];

  it('counts, sums and shares known keys, tracking unknowns separately', () => {
    const d = distributionBy(rows, (r) => r.key);
    expect(d.unknownCount).toBe(1);
    expect(d.entries).toEqual([
      { key: 'a', count: 2, share: 0.5, amount: 3000 },
      { key: 'b', count: 1, share: 0.25, amount: 5000 },
      { key: 'c', count: 1, share: 0.25, amount: 0 },
    ]);
  });

  it('follows a fixed order and can keep empty keys', () => {
    const d = distributionBy(rows, (r) => r.key, { order: ['c', 'z', 'a'] });
    expect(d.entries.map((e) => e.key)).toEqual(['c', 'a']);
    const withEmpty = distributionBy(rows, (r) => r.key, { order: ['c', 'z'], includeEmpty: true });
    expect(withEmpty.entries.map((e) => [e.key, e.count])).toEqual([
      ['c', 1],
      ['z', 0],
    ]);
  });
});

describe('crossTabulate', () => {
  it('builds a table, dropping rows/cols without items', () => {
    const t = crossTabulate(
      [
        { key: 'navy', col: 'outer' },
        { key: 'navy', col: 'tops' },
        { key: 'navy', col: 'tops' },
        { key: 'black', col: 'tops' },
        { key: undefined, col: 'tops' },
      ] satisfies Row[],
      (r) => r.key,
      (r) => r.col,
      { colOrder: ['outer', 'tops', 'shoes'] },
    );
    expect(t.rows).toEqual(['navy', 'black']);
    expect(t.cols).toEqual(['outer', 'tops']);
    expect(t.counts).toEqual([
      [1, 2],
      [0, 1],
    ]);
    expect(t.max).toBe(2);
  });
});

describe('priceBands', () => {
  it('assigns band boundaries as [min, max)', () => {
    expect(priceBandOf(0)?.label).toBe('〜3千円');
    expect(priceBandOf(2999)?.label).toBe('〜3千円');
    expect(priceBandOf(3000)?.label).toBe('3千〜5千円');
    expect(priceBandOf(120000)?.label).toBe('5万円〜');
  });

  it('reports every band, including empty ones', () => {
    const d = priceBandDistribution([{ totalPrice: 4000 }, { purchasePrice: 4500 }, {}]);
    expect(d.entries).toHaveLength(7);
    expect(d.entries.find((e) => e.key === '3千〜5千円')?.count).toBe(2);
    expect(d.unknownCount).toBe(1);
  });
});
