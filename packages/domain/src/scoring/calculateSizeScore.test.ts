import { describe, expect, it } from 'vitest';
import type { GarmentItem, Measurement } from '@seam/shared';
import { calculateSizeScore } from './calculateSizeScore';

const item = (overrides: Partial<GarmentItem> = {}): GarmentItem => ({
  id: 'i',
  status: 'owned',
  name: 'name',
  category: 't_shirt',
  isFitAnchor: false,
  isSellCandidate: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const m = (
  itemId: string,
  k: Measurement['key'],
  v: number,
  u: Measurement['unit'] = 'cm',
): Measurement => ({ id: `${itemId}-${k}`, itemId, key: k, value: v, unit: u });

describe('calculateSizeScore', () => {
  const candidate = item({ id: 'cand', status: 'wishlist' });

  it('returns neutral 70 when there are no anchors', () => {
    expect(calculateSizeScore(candidate, [], [])).toBe(70);
  });

  it('returns neutral when no anchor has comparable measurements', () => {
    const anchor = { item: item({ id: 'a' }), measurements: [m('a', 'waist', 80)] };
    expect(calculateSizeScore(candidate, [m('cand', 'shoulderWidth', 50)], [anchor])).toBe(70);
  });

  it('boosts score when measurements match an anchor closely', () => {
    const cMs = [m('cand', 'shoulderWidth', 50), m('cand', 'chestWidth', 54)];
    const anchor = {
      item: item({ id: 'a' }),
      measurements: [m('a', 'shoulderWidth', 50), m('a', 'chestWidth', 54)],
    };
    // 2 keys, both "same" → +40 → 110 → clamp to 100.
    expect(calculateSizeScore(candidate, cMs, [anchor])).toBe(100);
  });

  it('penalises score when warnings present', () => {
    const cMs = [m('cand', 'bodyLength', 70)]; // 10cm shorter than anchor (warning)
    const anchor = {
      item: item({ id: 'a' }),
      measurements: [m('a', 'bodyLength', 80)],
    };
    expect(calculateSizeScore(candidate, cMs, [anchor])).toBe(60);
  });

  it('uses the best anchor when multiple are provided', () => {
    const cMs = [m('cand', 'shoulderWidth', 50)];
    const goodAnchor = {
      item: item({ id: 'good' }),
      measurements: [m('good', 'shoulderWidth', 50)],
    };
    const badAnchor = {
      item: item({ id: 'bad' }),
      measurements: [m('bad', 'shoulderWidth', 70)],
    };
    expect(calculateSizeScore(candidate, cMs, [badAnchor, goodAnchor])).toBe(90);
  });

  it('clamps to [0, 100]', () => {
    const cMs = [
      m('cand', 'shoulderWidth', 30),
      m('cand', 'chestWidth', 30),
      m('cand', 'bodyLength', 50),
    ];
    const anchor = {
      item: item({ id: 'a' }),
      measurements: [
        m('a', 'shoulderWidth', 50),
        m('a', 'chestWidth', 60),
        m('a', 'bodyLength', 80),
      ],
    };
    const score = calculateSizeScore(candidate, cMs, [anchor]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
