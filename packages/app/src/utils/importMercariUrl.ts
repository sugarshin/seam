import * as FileSystem from 'expo-file-system/legacy';
import {
  MercariExtractionError,
  extractMercariFromHtml,
  parseMercariUrl,
} from '@seam/domain/extraction';
import type { ItemFormDefaults } from '../forms/ItemForm';
import { savePhoto, type SavedPhoto } from '../photos/savePhoto';
import { newId } from './ids';
import { fetchProductHtml } from './fetchProductHtml';

const downloadImage = async (imageUrl: string): Promise<SavedPhoto | null> => {
  const tmpName = `${newId()}.jpg`;
  const tmpPath = `${FileSystem.cacheDirectory ?? ''}${tmpName}`;
  try {
    const result = await FileSystem.downloadAsync(imageUrl, tmpPath);
    if (result.status !== 200) {
      await FileSystem.deleteAsync(tmpPath, { idempotent: true });
      return null;
    }
    const saved = await savePhoto(result.uri);
    await FileSystem.deleteAsync(tmpPath, { idempotent: true });
    return saved;
  } catch {
    await FileSystem.deleteAsync(tmpPath, { idempotent: true });
    return null;
  }
};

export class ImportUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportUrlError';
  }
}

/**
 * Fetch a Mercari item URL and return ItemForm defaults that prefill the
 * Wishlist creation form. URL のバリデーションが失敗したら ImportUrlError を
 * 投げる。
 */
export const importMercariUrl = async (url: string): Promise<ItemFormDefaults> => {
  const trimmed = url.trim();
  if (!parseMercariUrl(trimmed)) {
    throw new ImportUrlError('メルカリの商品 URL を入力してください');
  }

  let html: string;
  try {
    html = await fetchProductHtml(trimmed);
  } catch (err) {
    throw new ImportUrlError(err instanceof Error ? err.message : 'ページ取得に失敗しました');
  }

  let extraction;
  try {
    extraction = extractMercariFromHtml(html, trimmed);
  } catch (err) {
    if (err instanceof MercariExtractionError) {
      throw new ImportUrlError(err.message);
    }
    throw err;
  }

  const photos: SavedPhoto[] = [];
  if (extraction.primaryImageUrl) {
    const saved = await downloadImage(extraction.primaryImageUrl);
    if (saved) photos.push(saved);
  }

  return {
    values: {
      name: extraction.name,
      status: 'wishlist',
      sourceType: 'mercari',
      candidateCurrentPrice: extraction.priceJpy !== undefined ? String(extraction.priceJpy) : '',
      productUrl: extraction.productUrl,
    },
    photos,
  };
};
