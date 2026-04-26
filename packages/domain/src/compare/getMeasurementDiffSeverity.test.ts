import { describe, expect, it } from 'vitest';
import type { MeasurementDiff } from './compareMeasurements';
import { getMeasurementDiffSeverity } from './getMeasurementDiffSeverity';

const diff = (overrides: Partial<MeasurementDiff>): MeasurementDiff => ({
  key: 'chestWidth',
  candidateValue: 50,
  referenceValue: 50,
  diffCm: 0,
  diffPct: 0,
  comparable: true,
  ...overrides,
});

describe('getMeasurementDiffSeverity', () => {
  it('returns "same" for zero diff (top)', () => {
    expect(getMeasurementDiffSeverity(diff({}), 't_shirt')).toBe('same');
  });

  it('returns "close" for a 2cm chest diff (within close band, beyond same)', () => {
    // top close threshold = 3cm OR 4% (whichever is looser).
    // 2cm / 50 = 4% — pct hits exactly 4%; abs is 2/3 ≈ 0.67 → within close.
    const d = diff({ diffCm: 2, diffPct: 2 / 50 });
    expect(getMeasurementDiffSeverity(d, 't_shirt')).toBe('close');
  });

  it('returns "different" when beyond close but within different bounds', () => {
    // top different threshold = 5cm. diff 4.5cm on 50cm is 9% (above different
    // pct 8%) but the abs axis is within (4.5/5 = 0.9), so the looser-of-two
    // rule still yields "different".
    const d = diff({ diffCm: 4.5, diffPct: 4.5 / 50 });
    expect(getMeasurementDiffSeverity(d, 't_shirt')).toBe('different');
  });

  it('returns "warning" when diff exceeds every band', () => {
    // 10cm on 50cm chest is 20% — way over both axes.
    const d = diff({ diffCm: 10, diffPct: 0.2 });
    expect(getMeasurementDiffSeverity(d, 't_shirt')).toBe('warning');
  });

  it('directional rule fires when bodyLength is short by absAtWarning cm', () => {
    // bodyLength sign=negative, absAtWarning=4 → -4cm or worse → warning.
    const d = diff({ key: 'bodyLength', diffCm: -4, diffPct: -0.05, candidateValue: 76, referenceValue: 80 });
    expect(getMeasurementDiffSeverity(d, 't_shirt')).toBe('warning');
  });

  it('directional rule does NOT fire for positive bodyLength diff (item is longer)', () => {
    const d = diff({ key: 'bodyLength', diffCm: 5, diffPct: 5 / 80, candidateValue: 85, referenceValue: 80 });
    // 5cm on 80 = 6.25% — within different (8%), abs 5/5 = 1 hits different exactly.
    expect(getMeasurementDiffSeverity(d, 't_shirt')).toBe('different');
  });

  it('returns "different" for non-comparable diffs (no signal)', () => {
    const d = diff({ comparable: false, diffCm: 0, diffPct: 0 });
    expect(getMeasurementDiffSeverity(d, 'shoes')).toBe('different');
  });

  it('uses pants thresholds for pants category', () => {
    // pants close = 2cm OR 3% — 2.5cm on 80cm waist is 3.1% (close on abs not
    // hit: 2.5/2 = 1.25 > 1; pct: 3.1/3 = 1.04 > 1). Both above close, both
    // within different (4cm or 6%). Expect "different".
    const d = diff({ key: 'waist', diffCm: 2.5, diffPct: 2.5 / 80, candidateValue: 82.5, referenceValue: 80 });
    expect(getMeasurementDiffSeverity(d, 'pants')).toBe('different');
  });
});
