import { describe, expect, it } from 'vitest';
import { normalizeMaterial } from './normalizeMaterial';

describe('normalizeMaterial', () => {
  it('returns null for missing, blank and unrecognized input', () => {
    expect(normalizeMaterial(undefined)).toBeNull();
    expect(normalizeMaterial('')).toBeNull();
    expect(normalizeMaterial('不明')).toBeNull();
  });

  it('folds spellings into one family', () => {
    expect(normalizeMaterial('コットン 100%')).toBe('cotton');
    expect(normalizeMaterial('綿')).toBe('cotton');
    expect(normalizeMaterial('Cotton')).toBe('cotton');
    expect(normalizeMaterial('カシミア')).toBe('cashmere');
  });

  it('maps fabric names to their fiber', () => {
    expect(normalizeMaterial('デニム')).toBe('cotton');
    expect(normalizeMaterial('ツイード')).toBe('wool');
    expect(normalizeMaterial('スウェード')).toBe('suede');
  });

  it('picks the highest percentage', () => {
    expect(normalizeMaterial('ポリエステル20% ウール80%')).toBe('wool');
    expect(normalizeMaterial('80%ウール 20%ナイロン')).toBe('wool');
    expect(normalizeMaterial('綿 60%、ポリエステル 40%')).toBe('cotton');
  });

  it('falls back to the earliest mention without percentages', () => {
    expect(normalizeMaterial('ナイロン / ポリエステル')).toBe('nylon');
  });

  it('does not borrow the previous fiber percentage', () => {
    expect(normalizeMaterial('コットン100% ポリエステル')).toBe('cotton');
    expect(normalizeMaterial('ポリエステル ウール100%')).toBe('wool');
  });

  it('ignores filling and finishing words', () => {
    expect(normalizeMaterial('表地: ナイロン100% 中綿: ダウン90% フェザー10%')).toBe('nylon');
    expect(normalizeMaterial('起毛ポリエステル')).toBe('polyester');
  });

  it('reads multi-line labels', () => {
    expect(normalizeMaterial('表地: ナイロン100%\n裏地: ポリエステル100%')).toBe('nylon');
    expect(normalizeMaterial('ポリエステル 30%\r\nコットン 70%')).toBe('cotton');
  });
});
