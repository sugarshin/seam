/**
 * Extract a Mercari listing's basic fields from its SSR HTML.
 *
 * Mercari (App Router 化済み) は商品データの大半を client から API 経由で
 * 取得するため、SSR HTML には OGP / Open Graph product extension しか出ない。
 * このモジュールは AI を使わずに、メタタグだけから安定して取れる範囲を返す。
 *
 * 対応する URL 形式:
 *  - 通常出品: `https://jp.mercari.com/item/m<digits>`
 *  - Mercari Shops: `https://jp.mercari.com/shops/product/<base62 id>`
 *
 * Available fields:
 *  - itemId         (URL から)
 *  - kind           ('item' | 'shop')
 *  - productUrl     (canonical, og:url)
 *  - name           ('item' は og:title から、'shop' は document <title> から)
 *  - primaryImageUrl (og:image)
 *  - priceJpy       (product:price:amount; Shops は SSR に出ないので undefined)
 *
 * 取れないフィールド (description / seller / size / color / condition / brand /
 * 複数枚画像、および Shops の価格) は ItemForm 側で手入力する前提。
 */

const META_RE = /<meta\s[^>]+?\/?>/gi;
const PROPERTY_RE = /(?:property|name)=["']([^"']+)["']/i;
const CONTENT_RE = /content=["']([^"']*)["']/i;
const MERCARI_URL_RE = /^https?:\/\/jp\.mercari\.com(\/[^?#]*)/i;
const ITEM_PATH_RE = /^\/item\/(m\d+)\b/i;
const SHOP_PATH_RE = /^\/shops\/product\/([A-Za-z0-9]+)\b/i;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/gi;

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
};

const decodeHtmlEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (m, k: string) => HTML_ENTITY_MAP[k] ?? m);

const parseMetas = (html: string): Map<string, string> => {
  const map = new Map<string, string>();
  for (const m of html.matchAll(META_RE)) {
    const tag = m[0];
    const p = tag.match(PROPERTY_RE)?.[1];
    const c = tag.match(CONTENT_RE)?.[1];
    if (p && c !== undefined && !map.has(p.toLowerCase())) {
      map.set(p.toLowerCase(), decodeHtmlEntities(c));
    }
  }
  return map;
};

const stripMercariTitleSuffix = (title: string): string =>
  title
    .replace(/\s*by\s+メルカリ\s*$/u, '')
    .replace(/\s*[-–—]\s*メルカリ\s*$/u, '')
    .trim();

const parsePriceJpy = (
  amount: string | undefined,
  currency: string | undefined,
): number | undefined => {
  if (!amount || !currency) return undefined;
  if (currency.toUpperCase() !== 'JPY') return undefined;
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
};

export type MercariUrlInfo = {
  readonly kind: 'item' | 'shop';
  readonly itemId: string;
};

/**
 * Returns a tagged descriptor when the URL points to a jp.mercari.com item
 * page (`/item/m<digits>`) or Mercari Shops product page
 * (`/shops/product/<base62>`); otherwise null. US (`www.mercari.com`) は別
 * ドメインなので未対応。
 */
export const parseMercariUrl = (url: string): MercariUrlInfo | null => {
  if (typeof url !== 'string') return null;
  const hostMatch = url.match(MERCARI_URL_RE);
  if (!hostMatch) return null;
  const path = hostMatch[1] ?? '';
  const itemMatch = path.match(ITEM_PATH_RE);
  if (itemMatch?.[1]) return { kind: 'item', itemId: itemMatch[1] };
  const shopMatch = path.match(SHOP_PATH_RE);
  if (shopMatch?.[1]) return { kind: 'shop', itemId: shopMatch[1] };
  return null;
};

/**
 * Mercari Shops の og:title は "{商品名} - {ショップ名}" 形式で、ショップ名は
 * 任意文字列のため generic には剥がせない。document `<title>` は
 * "{商品名} - メルカリ" 固定なのでこちらを優先する。SVG 等の `<title>` 混入を
 * 避けるため "メルカリ" suffix を持つものを選ぶ。
 */
const findShopDocumentTitle = (html: string): string | undefined => {
  for (const m of html.matchAll(TITLE_RE)) {
    const txt = decodeHtmlEntities((m[1] ?? '').trim());
    if (/[-–—]\s*メルカリ\s*$/u.test(txt)) return txt;
  }
  return undefined;
};

export type MercariExtraction = {
  readonly kind: 'item' | 'shop';
  readonly itemId: string;
  readonly productUrl: string;
  readonly name: string;
  readonly primaryImageUrl?: string;
  readonly priceJpy?: number;
};

export class MercariExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MercariExtractionError';
  }
}

export const extractMercariFromHtml = (html: string, sourceUrl: string): MercariExtraction => {
  const metas = parseMetas(html);
  const ogUrl = metas.get('og:url');
  const info = parseMercariUrl(ogUrl ?? sourceUrl);
  if (!info) {
    throw new MercariExtractionError('メルカリの商品 URL ではありません');
  }

  const rawTitle =
    info.kind === 'shop'
      ? (findShopDocumentTitle(html) ?? metas.get('og:title'))
      : metas.get('og:title');
  if (!rawTitle) {
    throw new MercariExtractionError('商品名が見つかりませんでした');
  }
  const name = stripMercariTitleSuffix(rawTitle);
  if (!name) {
    throw new MercariExtractionError('商品名が空でした');
  }

  const primaryImageUrl = metas.get('og:image');
  const priceJpy =
    info.kind === 'item'
      ? parsePriceJpy(metas.get('product:price:amount'), metas.get('product:price:currency'))
      : undefined;

  const fallbackUrl =
    info.kind === 'item'
      ? `https://jp.mercari.com/item/${info.itemId}`
      : `https://jp.mercari.com/shops/product/${info.itemId}`;
  const productUrl = ogUrl ?? fallbackUrl;

  return {
    kind: info.kind,
    itemId: info.itemId,
    productUrl,
    name,
    primaryImageUrl,
    priceJpy,
  };
};
