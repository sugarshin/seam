import { describe, expect, it } from 'vitest';
import { MercariExtractionError, extractMercariFromHtml, parseMercariItemId } from './mercari';

const buildHtml = (metas: Record<string, string>): string => {
  const tags = Object.entries(metas)
    .map(([k, v]) => {
      const attr = k.startsWith('product:') || k.startsWith('twitter:') ? 'name' : 'property';
      return `<meta ${attr}="${k}" content="${v}"/>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html><head>${tags}</head><body></body></html>`;
};

describe('parseMercariItemId', () => {
  it.each([
    ['https://jp.mercari.com/item/m71522483801', 'm71522483801'],
    ['https://jp.mercari.com/item/m12345678901?ref=foo', 'm12345678901'],
    ['http://jp.mercari.com/item/m1', 'm1'],
  ])('parses %s', (url, expected) => {
    expect(parseMercariItemId(url)).toBe(expected);
  });

  it.each([
    'https://www.mercari.com/jp/item/m71522483801',
    'https://example.com/item/m71522483801',
    'https://jp.mercari.com/search?keyword=champion',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(parseMercariItemId(url)).toBeNull();
  });
});

describe('extractMercariFromHtml', () => {
  const url = 'https://jp.mercari.com/item/m71522483801';

  it('extracts name, price, image, productUrl', () => {
    const html = buildHtml({
      'og:title': 'Champion Reverse Weave パーカー Lサイズ by メルカリ',
      'og:url': url,
      'og:image': 'https://static.mercdn.net/item/detail/orig/photos/m71522483801_1.jpg?1777339695',
      'product:price:currency': 'JPY',
      'product:price:amount': '3800',
    });
    const r = extractMercariFromHtml(html, url);
    expect(r.itemId).toBe('m71522483801');
    expect(r.name).toBe('Champion Reverse Weave パーカー Lサイズ');
    expect(r.priceJpy).toBe(3800);
    expect(r.primaryImageUrl).toContain('m71522483801_1.jpg');
    expect(r.productUrl).toBe(url);
  });

  it('strips " - メルカリ" suffix when present', () => {
    const html = buildHtml({
      'og:title': '90s ヴィンテージスウェット - メルカリ',
      'og:url': url,
    });
    expect(extractMercariFromHtml(html, url).name).toBe('90s ヴィンテージスウェット');
  });

  it('decodes HTML entities in title', () => {
    const html = buildHtml({
      'og:title': 'A &amp; B Sweat &quot;rare&quot; by メルカリ',
      'og:url': url,
    });
    expect(extractMercariFromHtml(html, url).name).toBe('A & B Sweat "rare"');
  });

  it('falls back to sourceUrl when og:url is missing', () => {
    const html = buildHtml({
      'og:title': 'Foo by メルカリ',
    });
    const r = extractMercariFromHtml(html, url);
    expect(r.itemId).toBe('m71522483801');
    expect(r.productUrl).toBe(url);
  });

  it('skips price when currency is not JPY', () => {
    const html = buildHtml({
      'og:title': 'Foo by メルカリ',
      'og:url': url,
      'product:price:currency': 'USD',
      'product:price:amount': '120',
    });
    expect(extractMercariFromHtml(html, url).priceJpy).toBeUndefined();
  });

  it('skips price when amount is not finite', () => {
    const html = buildHtml({
      'og:title': 'Foo by メルカリ',
      'og:url': url,
      'product:price:currency': 'JPY',
      'product:price:amount': 'abc',
    });
    expect(extractMercariFromHtml(html, url).priceJpy).toBeUndefined();
  });

  it('throws when URL is not a Mercari item page', () => {
    const html = buildHtml({ 'og:title': 'Foo' });
    expect(() => extractMercariFromHtml(html, 'https://example.com/foo')).toThrow(
      MercariExtractionError,
    );
  });

  it('throws when og:title is missing', () => {
    const html = buildHtml({ 'og:url': url });
    expect(() => extractMercariFromHtml(html, url)).toThrow(MercariExtractionError);
  });
});
