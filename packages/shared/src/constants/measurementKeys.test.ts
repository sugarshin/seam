import { describe, it, expect } from 'vitest';
import {
  measurementKeysFor,
  defaultUnitFor,
  TOP_MEASUREMENT_KEYS,
  PANTS_MEASUREMENT_KEYS,
  SHOES_MEASUREMENT_KEYS,
} from './measurementKeys';

describe('measurementKeysFor', () => {
  it('returns top keys for hoodie', () => {
    expect(measurementKeysFor('hoodie')).toEqual(TOP_MEASUREMENT_KEYS);
  });

  it('returns pants keys for pants', () => {
    expect(measurementKeysFor('pants')).toEqual(PANTS_MEASUREMENT_KEYS);
  });

  it('returns shoes keys for shoes', () => {
    expect(measurementKeysFor('shoes')).toEqual(SHOES_MEASUREMENT_KEYS);
  });

  it('returns empty for accessory/bag/other', () => {
    expect(measurementKeysFor('bag')).toEqual([]);
    expect(measurementKeysFor('accessory')).toEqual([]);
    expect(measurementKeysFor('other')).toEqual([]);
  });
});

describe('defaultUnitFor', () => {
  it('uses cm for body measurements', () => {
    expect(defaultUnitFor('shoulderWidth')).toBe('cm');
    expect(defaultUnitFor('inseam')).toBe('cm');
    expect(defaultUnitFor('outsoleLength')).toBe('cm');
  });

  it('uses size unit for shoe size keys', () => {
    expect(defaultUnitFor('jpSize')).toBe('jp');
    expect(defaultUnitFor('usSize')).toBe('us');
    expect(defaultUnitFor('ukSize')).toBe('uk');
    expect(defaultUnitFor('euSize')).toBe('eu');
  });
});
