import { describe, expect, it } from 'vitest';
import { MercariExtractionError, extractMercariFromHtml, parseMercariUrl } from './mercari';

const buildHtml = (
  metas: Record<string, string>,
  opts: { documentTitle?: string } = {},
): string => {
  const tags = Object.entries(metas)
    .map(([k, v]) => {
      const attr = k.startsWith('product:') || k.startsWith('twitter:') ? 'name' : 'property';
      return `<meta ${attr}="${k}" content="${v}"/>`;
    })
    .join('\n');
  const titleTag = opts.documentTitle ? `<title>${opts.documentTitle}</title>` : '';
  return `<!DOCTYPE html><html><head>${titleTag}${tags}</head><body></body></html>`;
};

describe('parseMercariUrl', () => {
  it.each([
    ['https://jp.mercari.com/item/m71522483801', { kind: 'item' as const, itemId: 'm71522483801' }],
    [
      'https://jp.mercari.com/item/m12345678901?ref=foo',
      { kind: 'item' as const, itemId: 'm12345678901' },
    ],
    ['http://jp.mercari.com/item/m1', { kind: 'item' as const, itemId: 'm1' }],
    [
      'https://jp.mercari.com/shops/product/2JQ9wrRXRNrZ8H5pjWetAr',
      { kind: 'shop' as const, itemId: '2JQ9wrRXRNrZ8H5pjWetAr' },
    ],
    [
      'https://jp.mercari.com/shops/product/2JQ9wrRXRNrZ8H5pjWetAr?utm_medium=share&source_location=share',
      { kind: 'shop' as const, itemId: '2JQ9wrRXRNrZ8H5pjWetAr' },
    ],
  ])('parses %s', (url, expected) => {
    expect(parseMercariUrl(url)).toEqual(expected);
  });

  it.each([
    'https://www.mercari.com/jp/item/m71522483801',
    'https://example.com/item/m71522483801',
    'https://jp.mercari.com/search?keyword=champion',
    'https://jp.mercari.com/shops/abc/foo',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(parseMercariUrl(url)).toBeNull();
  });
});

describe('extractMercariFromHtml (item)', () => {
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
    expect(r.kind).toBe('item');
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

describe('extractMercariFromHtml (shop)', () => {
  const url = 'https://jp.mercari.com/shops/product/2JQ9wrRXRNrZ8H5pjWetAr';

  it('uses document <title> for name when og:title carries a shop suffix', () => {
    const html = buildHtml(
      {
        'og:title': '90s DOCKERS GOLF 2タック ワイドチノ ベージュ - UNVINT/フォロワー割',
        'og:url': url,
        'og:image':
          'https://assets.mercari-shops-static.com/-/large/plain/2JQ9wqyMWtUUJCknN9LzUq.jpg@jpg',
      },
      {
        documentTitle: '90s DOCKERS GOLF 2タック ワイドチノ ベージュ - メルカリ',
      },
    );
    const r = extractMercariFromHtml(html, url);
    expect(r.kind).toBe('shop');
    expect(r.itemId).toBe('2JQ9wrRXRNrZ8H5pjWetAr');
    expect(r.name).toBe('90s DOCKERS GOLF 2タック ワイドチノ ベージュ');
    expect(r.primaryImageUrl).toContain('2JQ9wqyMWtUUJCknN9LzUq.jpg');
    expect(r.productUrl).toBe(url);
  });

  it('does not extract price (Shops omits product:price meta tags from SSR)', () => {
    const html = buildHtml(
      {
        'og:title': 'Foo - SomeShop',
        'og:url': url,
      },
      { documentTitle: 'Foo - メルカリ' },
    );
    expect(extractMercariFromHtml(html, url).priceJpy).toBeUndefined();
  });

  it('ignores SVG <title> elements and picks the one ending with メルカリ', () => {
    const html = `<!DOCTYPE html><html><head>
<title>メルカリ</title>
<title>X</title>
<title>Foo Bar Item - メルカリ</title>
<meta property="og:title" content="Foo Bar Item - SomeShop"/>
<meta property="og:url" content="${url}"/>
</head><body></body></html>`;
    expect(extractMercariFromHtml(html, url).name).toBe('Foo Bar Item');
  });

  it('falls back to og:title (with shop suffix kept) when no document <title> has the メルカリ suffix', () => {
    const html = buildHtml({
      'og:title': 'Foo Item - SomeShop',
      'og:url': url,
    });
    // 完璧ではないが name=undefined よりはマシ。ユーザーが手で編集する想定。
    expect(extractMercariFromHtml(html, url).name).toBe('Foo Item - SomeShop');
  });

  it('falls back to sourceUrl when og:url is missing', () => {
    const html = buildHtml({ 'og:title': 'Foo - Shop' }, { documentTitle: 'Foo - メルカリ' });
    const r = extractMercariFromHtml(html, url);
    expect(r.itemId).toBe('2JQ9wrRXRNrZ8H5pjWetAr');
    expect(r.productUrl).toBe(url);
  });
});
