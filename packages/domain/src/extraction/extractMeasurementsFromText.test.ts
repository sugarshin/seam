import { describe, expect, it } from 'vitest';
import { extractMeasurementsFromText } from './extractMeasurementsFromText';

const findValue = (
  result: ReturnType<typeof extractMeasurementsFromText>,
  key: string,
): number | undefined => result.measurements.find((m) => m.key === key)?.value;

describe('extractMeasurementsFromText', () => {
  it('1) extracts a simple list of top measurements (designspec example)', () => {
    const text = '肩幅 58\n身幅 60cm\n着丈：約66cm\n袖丈 61';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
    expect(findValue(result, 'bodyLength')).toBe(66);
    expect(findValue(result, 'sleeveLength')).toBe(61);
    expect(result.measurements.every((m) => m.unit === 'cm')).toBe(true);
  });

  it('2) handles full-width colon and full-width spaces', () => {
    const text = '肩幅：58cm　身幅：60cm　着丈：66cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
    expect(findValue(result, 'bodyLength')).toBe(66);
  });

  it('3) parses full-width digits', () => {
    const text = '肩幅 ５８cm 身幅 ６０cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
  });

  it('4) accepts センチ as unit alias', () => {
    const text = '肩幅 58センチ 身幅 60センチ';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
  });

  it('5) "約" / "およそ" prefix is ignored', () => {
    const text = '肩幅 約58cm 身幅 およそ60cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
  });

  it('6) handles no-unit numeric values', () => {
    const text = '肩幅 58 身幅 60 着丈 66 袖丈 61';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
    expect(findValue(result, 'bodyLength')).toBe(66);
    expect(findValue(result, 'sleeveLength')).toBe(61);
  });

  it('7) recognises slash-separated lines', () => {
    const text = '肩幅 58cm / 身幅 60cm / 着丈 66cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
    expect(findValue(result, 'bodyLength')).toBe(66);
  });

  it('8) handles tilde range expression — picks the lower bound', () => {
    const text = '肩幅 58〜60cm 身幅 60～62cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
  });

  it('9) maps バスト/胸囲 → chestWidth', () => {
    const text = '肩幅 58 バスト 92cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(92);
  });

  it('10) maps 総丈 → bodyLength when only 総丈 appears', () => {
    const text = '総丈 66cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'bodyLength')).toBe(66);
  });

  it('11) extracts pants-specific keys', () => {
    const text = 'ウエスト 91cm 股下 76cm ワタリ 34cm 裾幅 23cm';
    const result = extractMeasurementsFromText(text, 'denim_pants');
    expect(findValue(result, 'waist')).toBe(91);
    expect(findValue(result, 'inseam')).toBe(76);
    expect(findValue(result, 'thighWidth')).toBe(34);
    expect(findValue(result, 'hemWidth')).toBe(23);
    expect(result.confidence === 'high' || result.confidence === 'medium').toBe(true);
  });

  it('12) maps inch (W32inch) to cm for waist', () => {
    const text = 'W32inch 股下 76cm';
    const result = extractMeasurementsFromText(text, 'denim_pants');
    // 32 inch ≈ 81.3 cm
    const waist = findValue(result, 'waist');
    expect(waist).toBeDefined();
    expect(waist).toBeCloseTo(81.3, 1);
    expect(findValue(result, 'inseam')).toBe(76);
  });

  it('13) plain inch suffix (32inch) → cm', () => {
    const text = 'ウエスト 32inch';
    const result = extractMeasurementsFromText(text, 'denim_pants');
    const waist = findValue(result, 'waist');
    expect(waist).toBeCloseTo(81.3, 1);
    // Stored with cm unit after conversion
    expect(result.measurements.find((m) => m.key === 'waist')?.unit).toBe('cm');
  });

  it('14) discards out-of-range values (e.g. parka chestWidth 200cm)', () => {
    const text = '肩幅 58cm 身幅 200cm 着丈 66cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'bodyLength')).toBe(66);
    expect(findValue(result, 'chestWidth')).toBeUndefined();
    expect(result.unmatchedKeys).toContain('chestWidth');
  });

  it('15) handles multi-line listing with mixed punctuation', () => {
    const text = `[実寸]
肩幅 :  58 cm
身幅: 60cm
着丈 = 66cm
袖丈／61cm`;
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    expect(findValue(result, 'chestWidth')).toBe(60);
    expect(findValue(result, 'bodyLength')).toBe(66);
    expect(findValue(result, 'sleeveLength')).toBe(61);
  });

  it('16) returns low confidence when nothing matches', () => {
    const text = 'ノーブランド USED 状態は写真でご確認ください。';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(result.measurements).toHaveLength(0);
    expect(result.confidence).toBe('low');
    expect(result.unmatchedKeys).toEqual([]);
  });

  it('17) returns low confidence with empty text', () => {
    const result = extractMeasurementsFromText('', 'hoodie');
    expect(result.measurements).toHaveLength(0);
    expect(result.confidence).toBe('low');
    expect(result.rawText).toBe('');
  });

  it('18) returns low confidence with whitespace-only text', () => {
    const result = extractMeasurementsFromText('   \n  ', 'hoodie');
    expect(result.measurements).toHaveLength(0);
    expect(result.confidence).toBe('low');
  });

  it('19) does not throw for category with no measurement keys (bag)', () => {
    expect(() => extractMeasurementsFromText('肩幅 58cm', 'bag')).not.toThrow();
    const result = extractMeasurementsFromText('肩幅 58cm', 'bag');
    expect(result.measurements).toHaveLength(0);
    expect(result.confidence).toBe('low');
  });

  it('20) high confidence requires units explicit AND ≥70% coverage', () => {
    // hoodie expects 5 keys; supply 4 with cm → 80% coverage, all units explicit.
    const text = '肩幅 58cm 身幅 60cm 着丈 66cm 袖丈 61cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(result.measurements).toHaveLength(4);
    expect(result.confidence).toBe('high');
  });

  it('21) ≥70% but missing units → medium (not high)', () => {
    const text = '肩幅 58 身幅 60 着丈 66 袖丈 61';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(result.confidence).toBe('medium');
  });

  it('22) handles fractional cm values', () => {
    const text = '肩幅 58.5cm 身幅 60.2cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58.5);
    expect(findValue(result, 'chestWidth')).toBe(60.2);
  });

  it('23) does not eat year-like 2024 as a measurement', () => {
    const text = '2024年購入 / 肩幅 58cm';
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(58);
    // 2024 should not be picked as bodyLength etc.
    const out = result.measurements.find((m) => m.value === 2024);
    expect(out).toBeUndefined();
  });

  it('24) realistic Mercari-style listing', () => {
    const text = `Champion リバースウィーブ パーカー XL
[サイズ] XL
[実寸 (cm)]
肩幅: 60
身幅: 66
着丈: 70
袖丈: 64

USA製 90s 古着`;
    const result = extractMeasurementsFromText(text, 'hoodie');
    expect(findValue(result, 'shoulderWidth')).toBe(60);
    expect(findValue(result, 'chestWidth')).toBe(66);
    expect(findValue(result, 'bodyLength')).toBe(70);
    expect(findValue(result, 'sleeveLength')).toBe(64);
  });

  it('25) realistic pants listing with W/L inch', () => {
    const text = `Levis 501 W32 L34
ウエスト 81cm
股下 76cm
ワタリ 32cm
裾幅 21cm`;
    const result = extractMeasurementsFromText(text, 'denim_pants');
    expect(findValue(result, 'waist')).toBe(81);
    expect(findValue(result, 'inseam')).toBe(76);
    expect(findValue(result, 'thighWidth')).toBe(32);
    expect(findValue(result, 'hemWidth')).toBe(21);
  });
});
