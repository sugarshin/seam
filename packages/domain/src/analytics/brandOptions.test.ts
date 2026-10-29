import { describe, expect, it } from 'vitest';
import { brandOptions, searchBrandOptions } from './brandOptions';

describe('brandOptions', () => {
  it('skips missing and blank names', () => {
    expect(brandOptions([undefined, null, '', '  '])).toEqual([]);
  });

  it('collapses case, width and curly-quote variants into one label', () => {
    expect(brandOptions(["Levi's", "LEVI'S", 'ｌｅｖｉ’ｓ'])).toEqual(["Levi's"]);
  });

  it('keeps the most frequent spelling, first seen on ties', () => {
    expect(brandOptions(['champion', 'Champion', 'Champion'])).toEqual(['Champion']);
    expect(brandOptions(['champion', 'Champion'])).toEqual(['champion']);
  });

  it('trims labels and sorts by normalized key', () => {
    expect(brandOptions(['  Wrangler ', 'carhartt', 'Champion', 'リーバイス'])).toEqual([
      'carhartt',
      'Champion',
      'Wrangler',
      'リーバイス',
    ]);
  });
});

describe('searchBrandOptions', () => {
  const options = ['Champion', "Levi's", 'The North Face', 'Wrangler', 'リーバイス'];

  it('returns every option and nothing to create for a blank query', () => {
    expect(searchBrandOptions(options, '  ')).toEqual({
      matches: options,
      exact: undefined,
      createLabel: undefined,
    });
  });

  it('treats a spelling variant of an existing brand as that brand', () => {
    const r = searchBrandOptions(options, "LEVI'S");
    expect(r.exact).toBe("Levi's");
    expect(r.createLabel).toBeUndefined();
    expect(r.matches).toEqual(["Levi's"]);

    expect(searchBrandOptions(options, 'ｃｈａｍｐｉｏｎ').exact).toBe('Champion');
    expect(searchBrandOptions(options, ' the  north face ').exact).toBe('The North Face');
  });

  it('matches ignoring spaces and punctuation, prefix matches first', () => {
    expect(searchBrandOptions(options, 'levis').matches).toEqual(["Levi's"]);
    expect(searchBrandOptions(options, 'northface').matches).toEqual(['The North Face']);
    expect(searchBrandOptions(['Abc Wrangler', 'Wrangler'], 'wrang').matches).toEqual([
      'Wrangler',
      'Abc Wrangler',
    ]);
    expect(searchBrandOptions(options, 'リーバ').matches).toEqual(['リーバイス']);
  });

  it('offers a new brand only when no option is the same brand', () => {
    const r = searchBrandOptions(options, '  Levi  Strauss ');
    expect(r.exact).toBeUndefined();
    expect(r.createLabel).toBe('Levi Strauss');

    // A near miss is still offered alongside the existing candidates.
    const near = searchBrandOptions(options, 'levis');
    expect(near.exact).toBeUndefined();
    expect(near.createLabel).toBe('levis');
  });
});
