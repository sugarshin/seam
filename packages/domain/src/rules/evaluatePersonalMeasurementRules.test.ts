import { describe, expect, it } from 'vitest';
import type { Measurement, MeasurementRule } from '@seam/shared';
import { evaluatePersonalMeasurementRules } from './evaluatePersonalMeasurementRules';

const m = (
  itemId: string,
  k: Measurement['key'],
  v: number,
  u: Measurement['unit'] = 'cm',
): Measurement => ({ id: `${itemId}-${k}`, itemId, key: k, value: v, unit: u });

const rule = (overrides: Partial<MeasurementRule> = {}): MeasurementRule => ({
  id: 'r',
  category: 't_shirt',
  measurementKey: 'shoulderWidth',
  operator: 'lt',
  value: 47,
  severity: 'ng',
  message: '肩幅が狭すぎる',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('evaluatePersonalMeasurementRules', () => {
  it('returns empty when there are no rules', () => {
    const violations = evaluatePersonalMeasurementRules(
      [m('i', 'shoulderWidth', 45)],
      [],
      't_shirt',
    );
    expect(violations).toEqual([]);
  });

  it('flags violation when operator matches', () => {
    const r = rule({});
    const violations = evaluatePersonalMeasurementRules(
      [m('i', 'shoulderWidth', 45)],
      [r],
      't_shirt',
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.ruleId).toBe('r');
    expect(violations[0]?.severity).toBe('ng');
  });

  it('does not flag when operator does not match', () => {
    const r = rule({ operator: 'lt', value: 40 });
    const violations = evaluatePersonalMeasurementRules(
      [m('i', 'shoulderWidth', 45)],
      [r],
      't_shirt',
    );
    expect(violations).toEqual([]);
  });

  it('skips rules for other categories', () => {
    const r = rule({ category: 'denim_pants' });
    const violations = evaluatePersonalMeasurementRules(
      [m('i', 'shoulderWidth', 45)],
      [r],
      't_shirt',
    );
    expect(violations).toEqual([]);
  });

  it('skips when no measurement matches the rule key', () => {
    const r = rule({ measurementKey: 'chestWidth' });
    const violations = evaluatePersonalMeasurementRules(
      [m('i', 'shoulderWidth', 45)],
      [r],
      't_shirt',
    );
    expect(violations).toEqual([]);
  });

  it('normalises inch measurements to cm before comparing', () => {
    const r = rule({ value: 50 });
    // 19 inch = 48.26 cm, NOT below 50, but rule operator='lt' on 50 →
    // 48.26 < 50 → flagged.
    const violations = evaluatePersonalMeasurementRules(
      [m('i', 'shoulderWidth', 19, 'inch')],
      [r],
      't_shirt',
    );
    expect(violations).toHaveLength(1);
  });

  it('skips shoes-size rules when units differ', () => {
    const r = rule({
      category: 'sneakers',
      measurementKey: 'jpSize',
      operator: 'gt',
      value: 28,
    });
    const violations = evaluatePersonalMeasurementRules(
      [m('i', 'jpSize', 9, 'us')],
      [r],
      'sneakers',
    );
    expect(violations).toEqual([]);
  });

  it('returns multiple violations independently', () => {
    const r1 = rule({ id: 'r1', operator: 'lt', value: 50 });
    const r2 = rule({
      id: 'r2',
      measurementKey: 'chestWidth',
      operator: 'gt',
      value: 60,
      severity: 'warning',
      message: 'too wide',
    });
    const violations = evaluatePersonalMeasurementRules(
      [m('i', 'shoulderWidth', 45), m('i', 'chestWidth', 65)],
      [r1, r2],
      't_shirt',
    );
    expect(violations.map((v) => v.ruleId).sort()).toEqual(['r1', 'r2']);
  });
});
