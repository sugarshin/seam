import { describe, expect, it } from 'vitest';
import { normalizeColor } from './normalizeColor';

describe('normalizeColor', () => {
  it('returns null for missing, blank and unrecognized input', () => {
    expect(normalizeColor(undefined)).toBeNull();
    expect(normalizeColor('  ')).toBeNull();
    expect(normalizeColor('不明')).toBeNull();
  });

  it('folds katakana, kanji and English spellings into one family', () => {
    expect(normalizeColor('ネイビー')).toBe('navy');
    expect(normalizeColor('紺')).toBe('navy');
    expect(normalizeColor('NAVY')).toBe('navy');
    expect(normalizeColor('ﾈｲﾋﾞｰ')).toBe('navy');
  });

  it('uses the head (last) color of compound names', () => {
    expect(normalizeColor('ダークネイビー')).toBe('navy');
    expect(normalizeColor('オフホワイト')).toBe('white');
    expect(normalizeColor('ライトブルー')).toBe('blue');
    expect(normalizeColor('チャコールグレー')).toBe('gray');
    expect(normalizeColor('ワインレッド')).toBe('red');
    expect(normalizeColor('Light Blue')).toBe('blue');
  });

  it('prefers the longer keyword on ties', () => {
    expect(normalizeColor('ネイビーブルー')).toBe('navy');
    expect(normalizeColor('グレージュ')).toBe('beige');
    expect(normalizeColor('Olive Drab')).toBe('khaki');
  });

  it('maps vintage-specific names', () => {
    expect(normalizeColor('インディゴ')).toBe('blue');
    expect(normalizeColor('杢グレー')).toBe('gray');
    expect(normalizeColor('生成り')).toBe('white');
    expect(normalizeColor('キャメル')).toBe('beige');
    expect(normalizeColor('タン')).toBe('beige');
  });

  it('treats patterns and separated two-tone colors as multi', () => {
    expect(normalizeColor('タータンチェック')).toBe('multi');
    expect(normalizeColor('ボーダー')).toBe('multi');
    expect(normalizeColor('白/黒')).toBe('multi');
    expect(normalizeColor('ネイビー×ホワイト')).toBe('multi');
    expect(normalizeColor('black x white')).toBe('multi');
  });

  it('does not match ASCII keywords inside other words', () => {
    expect(normalizeColor('colored')).toBeNull();
    expect(normalizeColor('ボタン')).toBeNull();
  });
});
