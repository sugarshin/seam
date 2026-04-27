import * as FileSystem from 'expo-file-system/legacy';
import { sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { db, schema } from '../db/client';

/** Loose row shape — each table's rows are arbitrary records of scalars. */
const RowSchema = z.record(z.unknown());

const TablesSchema = z.object({
  items: z.array(RowSchema),
  measurements: z.array(RowSchema),
  photos: z.array(RowSchema),
  fitAnchors: z.array(RowSchema),
  candidateInfos: z.array(RowSchema),
  candidateEvaluations: z.array(RowSchema),
  decisionLogs: z.array(RowSchema),
  failureLogs: z.array(RowSchema),
  measurementRules: z.array(RowSchema),
  brandGuides: z.array(RowSchema),
  brandChecklistStates: z.array(RowSchema),
  wearLogs: z.array(RowSchema),
  saleInfos: z.array(RowSchema),
  priceSnapshots: z.array(RowSchema),
  tags: z.array(RowSchema),
  itemTags: z.array(RowSchema),
  reminders: z.array(RowSchema),
});

const ExportPayloadSchema = z.object({
  meta: z.object({
    schemaVersion: z.number(),
    exportedAt: z.string(),
    appVersion: z.string(),
  }),
  tables: TablesSchema,
});

type ExportPayload = z.infer<typeof ExportPayloadSchema>;
type TableName = keyof ExportPayload['tables'];

export type ImportMode = 'merge' | 'replace';

export type ImportResult = {
  insertedCounts: Record<string, number>;
  errors: string[];
};

/**
 * Tables in dependency order. Children must come AFTER their parents so that
 * FK references are satisfied (we use `references(...)` with no deferral).
 * Reverse this order when truncating in 'replace' mode.
 */
const IMPORT_ORDER: readonly TableName[] = [
  'items',
  'fitAnchors',
  'measurements',
  'photos',
  'candidateInfos',
  'candidateEvaluations',
  'decisionLogs',
  'failureLogs',
  'measurementRules',
  'brandGuides',
  'brandChecklistStates',
  'wearLogs',
  'saleInfos',
  'priceSnapshots',
  'tags',
  'itemTags',
  'reminders',
];

type TableHandle = { table: SQLiteTable; pk: readonly string[] };

const TABLE_HANDLES: Record<TableName, TableHandle> = {
  items: { table: schema.items, pk: ['id'] },
  measurements: { table: schema.measurements, pk: ['id'] },
  photos: { table: schema.photos, pk: ['id'] },
  fitAnchors: { table: schema.fitAnchors, pk: ['id'] },
  candidateInfos: { table: schema.candidateInfos, pk: ['itemId'] },
  candidateEvaluations: { table: schema.candidateEvaluations, pk: ['id'] },
  decisionLogs: { table: schema.decisionLogs, pk: ['id'] },
  failureLogs: { table: schema.failureLogs, pk: ['id'] },
  measurementRules: { table: schema.measurementRules, pk: ['id'] },
  brandGuides: { table: schema.brandGuides, pk: ['id'] },
  brandChecklistStates: { table: schema.brandChecklistStates, pk: ['id'] },
  wearLogs: { table: schema.wearLogs, pk: ['id'] },
  saleInfos: { table: schema.saleInfos, pk: ['itemId'] },
  priceSnapshots: { table: schema.priceSnapshots, pk: ['id'] },
  tags: { table: schema.tags, pk: ['id'] },
  itemTags: { table: schema.itemTags, pk: ['itemId', 'tagId'] },
  reminders: { table: schema.reminders, pk: ['id'] },
};

/**
 * Parse and validate the on-disk JSON file. Throws if malformed.
 */
const readPayload = async (uri: string): Promise<ExportPayload> => {
  const raw = await FileSystem.readAsStringAsync(uri);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON のパースに失敗: ${err instanceof Error ? err.message : String(err)}`);
  }
  return ExportPayloadSchema.parse(parsed);
};

/**
 * Truncate the entire database in reverse dependency order. Used by
 * `replace` mode and by `dataReset`.
 */
export const truncateAllTables = async (): Promise<void> => {
  for (let i = IMPORT_ORDER.length - 1; i >= 0; i -= 1) {
    const tableName = IMPORT_ORDER[i];
    if (!tableName) continue;
    const handle = TABLE_HANDLES[tableName];

    await db.delete(handle.table as never);
  }
};

const buildPkSet = async (tableName: TableName): Promise<Set<string>> => {
  const handle = TABLE_HANDLES[tableName];
  const rows = (await db.select().from(handle.table as never)) as Record<string, unknown>[];
  const set = new Set<string>();
  for (const r of rows) {
    set.add(handle.pk.map((k) => String(r[k] ?? '')).join('::'));
  }
  return set;
};

const rowKey = (row: Record<string, unknown>, pkCols: readonly string[]): string =>
  pkCols.map((k) => String(row[k] ?? '')).join('::');

/**
 * Import a JSON export file produced by `exportData.ts` back into the local
 * database. In 'replace' mode existing rows are wiped first; in 'merge' mode
 * rows whose primary key already exists are skipped.
 */
export const importFromJsonFile = async (
  uri: string,
  opts: { mode: ImportMode },
): Promise<ImportResult> => {
  const payload = await readPayload(uri);
  const insertedCounts: Record<string, number> = {};
  const errors: string[] = [];

  if (opts.mode === 'replace') {
    try {
      await truncateAllTables();
    } catch (err) {
      errors.push(`truncate failed: ${err instanceof Error ? err.message : String(err)}`);
      return { insertedCounts, errors };
    }
  }

  for (const tableName of IMPORT_ORDER) {
    const handle = TABLE_HANDLES[tableName];
    const incoming = payload.tables[tableName];
    if (incoming.length === 0) {
      insertedCounts[tableName] = 0;
      continue;
    }

    let toInsert: Record<string, unknown>[];
    if (opts.mode === 'merge') {
      const existing = await buildPkSet(tableName);
      toInsert = incoming.filter((row) => !existing.has(rowKey(row, handle.pk))) as Record<
        string,
        unknown
      >[];
    } else {
      toInsert = incoming as Record<string, unknown>[];
    }

    if (toInsert.length === 0) {
      insertedCounts[tableName] = 0;
      continue;
    }

    try {
      // Insert in chunks to keep the SQLite parameter count well under the
      // default limit (~999 host params).
      const CHUNK = 50;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);

        await db.insert(handle.table as never).values(chunk as never);
      }
      insertedCounts[tableName] = toInsert.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${tableName}: ${msg}`);
      insertedCounts[tableName] = 0;
    }
  }

  // Reset SQLite's incremental row id counter is unnecessary — all our PKs are
  // text cuids — so nothing else to do here.
  return { insertedCounts, errors };
};

// Suppress unused-warning when we add a logger later.
void sql;
