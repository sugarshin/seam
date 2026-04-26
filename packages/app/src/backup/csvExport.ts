import * as FileSystem from 'expo-file-system/legacy';
import { db, schema } from '../db/client';
import { nowIso } from '../utils/dates';

/**
 * RFC 4180-ish CSV cell escaping. Always quote, double internal quotes.
 * Numbers and booleans are stringified; nulls become empty cells.
 */
const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '""';
  if (typeof v === 'boolean') return `"${v ? 'true' : 'false'}"`;
  if (typeof v === 'number') return `"${v}"`;
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
};

const csvRow = (cells: readonly unknown[]): string => cells.map(csvCell).join(',');

const ITEM_HEADERS = [
  'id',
  'status',
  'name',
  'brand',
  'modelName',
  'category',
  'color',
  'sizeLabel',
  'purchasePrice',
  'shippingFee',
  'totalPrice',
  'purchaseDate',
  'purchaseSource',
  'productUrl',
  'conditionRank',
  'conditionNotes',
  'fitRating',
  'favoriteScore',
  'isFitAnchor',
  'isSellCandidate',
  'notes',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Export the `items` table to a CSV file in `documentDirectory/exports/` and
 * return the absolute path. The schema mirrors the columns 1:1 so the file
 * round-trips cleanly through spreadsheet apps.
 */
export const exportItemsToCsv = async (): Promise<string> => {
  const rows = await db.select().from(schema.items);

  const lines: string[] = [];
  lines.push(ITEM_HEADERS.join(','));
  for (const r of rows) {
    lines.push(
      csvRow([
        r.id,
        r.status,
        r.name,
        r.brand,
        r.modelName,
        r.category,
        r.color,
        r.sizeLabel,
        r.purchasePrice,
        r.shippingFee,
        r.totalPrice,
        r.purchaseDate,
        r.purchaseSource,
        r.productUrl,
        r.conditionRank,
        r.conditionNotes,
        r.fitRating,
        r.favoriteScore,
        r.isFitAnchor,
        r.isSellCandidate,
        r.notes,
        r.createdAt,
        r.updatedAt,
      ]),
    );
  }
  // Trailing newline keeps `wc -l` happy on Unix; harmless elsewhere.
  const content = `${lines.join('\n')}\n`;

  const baseDir = `${FileSystem.documentDirectory ?? ''}exports/`;
  const dirInfo = await FileSystem.getInfoAsync(baseDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  }
  const stamp = nowIso().replace(/[:.]/g, '-');
  const path = `${baseDir}seam-items-${stamp}.csv`;
  await FileSystem.writeAsStringAsync(path, content);
  return path;
};
