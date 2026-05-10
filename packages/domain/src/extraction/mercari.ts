/**
 * Extract a Mercari listing's basic fields from its SSR HTML.
 *
 * Mercari (App Router 化済み) は商品データの大半を client から API 経由で
 * 取得するため、SSR HTML には OGP / Open Graph product extension しか出ない。
 * このモジュールは AI を使わずに、メタタグだけから安定して取れる範囲を返す。
 *
 * Available fields:
 *  - itemId       (URL から)
 *  - productUrl   (canonical, og:url)
 *  - name         (og:title から末尾 " by メルカリ" 等を除去)
 *  - primaryImageUrl (og:image)
 *  - priceJpy     (product:price:amount, currency が JPY のときのみ)
 *
 * 取れないフィールド (description / seller / size / color / condition / brand /
 * 複数枚画像) は ItemForm 側で手入力する前提。
 */

const META_RE = /<meta\s[^>]+?\/?>/gi;
const PROPERTY_RE = /(?:property|name)=["']([^"']+)["']/i;
const CONTENT_RE = /content=["']([^"']*)["']/i;
const MERCARI_URL_RE = /^https?:\/\/jp\.mercari\.com(\/[^?#]*)/i;
const ITEM_ID_RE = /\/item\/(m\d+)\b/i;

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

/**
 * Returns the Mercari item ID (`m\d+`) if the URL points to a jp.mercari.com
 * item page; otherwise null. US (www.mercari.com) は別ドメインなので未対応。
 */
export const parseMercariItemId = (url: string): string | null => {
  if (typeof url !== 'string') return null;
  const hostMatch = url.match(MERCARI_URL_RE);
  if (!hostMatch) return null;
  const path = hostMatch[1] ?? '';
  const idMatch = path.match(ITEM_ID_RE);
  return idMatch?.[1] ?? null;
};

export type MercariExtraction = {
  itemId: string;
  productUrl: string;
  name: string;
  primaryImageUrl?: string;
  priceJpy?: number;
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
  const itemId = parseMercariItemId(ogUrl ?? sourceUrl);
  if (!itemId) {
    throw new MercariExtractionError('メルカリの商品 URL ではありません');
  }
  const rawTitle = metas.get('og:title');
  if (!rawTitle) {
    throw new MercariExtractionError('og:title が見つかりませんでした');
  }
  const name = stripMercariTitleSuffix(rawTitle);
  if (!name) {
    throw new MercariExtractionError('商品名が空でした');
  }
  const primaryImageUrl = metas.get('og:image');
  const priceJpy = parsePriceJpy(
    metas.get('product:price:amount'),
    metas.get('product:price:currency'),
  );
  const productUrl = ogUrl ?? `https://jp.mercari.com/item/${itemId}`;
  return { itemId, productUrl, name, primaryImageUrl, priceJpy };
};
