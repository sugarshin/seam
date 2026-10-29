import { describe, expect, it } from 'vitest';
import {
  GARMENT_CATEGORIES,
  MAJOR_CATEGORIES,
  categoriesOfMajor,
  majorCategoryOf,
  measurementGroupOf,
} from './categories';

describe('majorCategoryOf', () => {
  it('puts jackets and coats into outer', () => {
    expect(majorCategoryOf('denim_jacket')).toBe('outer');
    expect(majorCategoryOf('nylon_jacket')).toBe('outer');
    expect(majorCategoryOf('coat')).toBe('outer');
  });

  it('treats t-shirts and tank tops as inner, cardigans as tops', () => {
    expect(majorCategoryOf('t_shirt')).toBe('inner');
    expect(majorCategoryOf('long_sleeve_t_shirt')).toBe('inner');
    expect(majorCategoryOf('tank_top')).toBe('inner');
    expect(majorCategoryOf('cardigan')).toBe('tops');
    expect(majorCategoryOf('thermal_long_sleeve_t_shirt')).toBe('tops');
    expect(majorCategoryOf('knit')).toBe('tops');
    expect(majorCategoryOf('zip_hoodie')).toBe('tops');
    expect(majorCategoryOf('long_sleeve_shirt')).toBe('tops');
  });

  it('maps pants to bottoms and footwear to shoes', () => {
    expect(majorCategoryOf('denim_pants')).toBe('bottoms');
    expect(majorCategoryOf('shorts')).toBe('bottoms');
    expect(majorCategoryOf('sneakers')).toBe('shoes');
  });

  it('falls back to other for bags and accessories', () => {
    expect(majorCategoryOf('bag')).toBe('other');
    expect(majorCategoryOf('accessory')).toBe('other');
  });
});

describe('categoriesOfMajor', () => {
  it('partitions every garment category exactly once', () => {
    const all = MAJOR_CATEGORIES.flatMap((m) => categoriesOfMajor(m));
    expect(all).toHaveLength(GARMENT_CATEGORIES.length);
    expect(new Set(all)).toEqual(new Set(GARMENT_CATEGORIES));
  });
});

describe('measurementGroupOf', () => {
  it('measures every outer / tops / inner garment as a top', () => {
    const upper = (['outer', 'tops', 'inner'] as const).flatMap((m) => categoriesOfMajor(m));
    for (const c of upper) expect(measurementGroupOf(c), c).toBe('top');
  });
});
