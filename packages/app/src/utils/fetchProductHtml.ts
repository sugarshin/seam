/**
 * Fetch a product page's HTML with a mobile Safari User-Agent.
 *
 * Mercari は Cloudflare 配下だが、iOS Safari の UA を投げれば素朴な fetch
 * でも 200 が返る (実機検証済み)。bot 検知が強くなったときに UA を切り替え
 * られるよう User-Agent はここに集約する。
 */

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

const DEFAULT_TIMEOUT_MS = 15_000;

export class FetchProductHtmlError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FetchProductHtmlError';
    this.status = status;
  }
}

export type FetchProductHtmlOptions = {
  timeoutMs?: number;
  userAgent?: string;
};

export const fetchProductHtml = async (
  url: string,
  opts: FetchProductHtmlOptions = {},
): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': opts.userAgent ?? DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new FetchProductHtmlError(
        `ページの取得に失敗しました (HTTP ${res.status})`,
        res.status,
      );
    }
    return await res.text();
  } catch (err) {
    if (err instanceof FetchProductHtmlError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FetchProductHtmlError('ページの取得がタイムアウトしました');
    }
    throw new FetchProductHtmlError(
      err instanceof Error ? err.message : 'ページの取得に失敗しました',
    );
  } finally {
    clearTimeout(timer);
  }
};
