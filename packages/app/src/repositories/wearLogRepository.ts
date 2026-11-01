import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { localDayRange } from '@seam/domain/wear';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import type { WearLog } from '@seam/shared';

type Row = typeof schema.wearLogs.$inferSelect;

const toLog = (row: Row): WearLog => ({
  id: row.id,
  itemId: row.itemId,
  wornAt: row.wornAt,
  notes: row.notes ?? undefined,
});

export type WearLogInput = {
  itemId: string;
  wornAt: string;
  notes?: string;
};

export const wearLogRepository = {
  async listByItem(itemId: string): Promise<WearLog[]> {
    const rows = await db
      .select()
      .from(schema.wearLogs)
      .where(eq(schema.wearLogs.itemId, itemId))
      .orderBy(desc(schema.wearLogs.wornAt));
    return rows.map(toLog);
  },

  async countByItem(itemId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.wearLogs)
      .where(eq(schema.wearLogs.itemId, itemId));
    return Number(rows[0]?.count ?? 0);
  },

  async lastWornAt(itemId: string): Promise<string | null> {
    const rows = await db
      .select({ wornAt: schema.wearLogs.wornAt })
      .from(schema.wearLogs)
      .where(eq(schema.wearLogs.itemId, itemId))
      .orderBy(desc(schema.wearLogs.wornAt))
      .limit(1);
    return rows[0]?.wornAt ?? null;
  },

  async create(input: WearLogInput): Promise<WearLog> {
    const row: Row = {
      id: newId(),
      itemId: input.itemId,
      wornAt: input.wornAt,
      notes: input.notes ?? null,
    };
    await db.insert(schema.wearLogs).values(row);
    return toLog(row);
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.wearLogs).where(eq(schema.wearLogs.id, id));
  },

  async deleteByItem(itemId: string): Promise<void> {
    await db.delete(schema.wearLogs).where(eq(schema.wearLogs.itemId, itemId));
  },

  /**
   * Total wear-log count across the wardrobe. Used by the Stats screen.
   */
  async countAll(): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.wearLogs);
    return Number(rows[0]?.count ?? 0);
  },

  /**
   * Per-item wear counts for a set of items. Items with zero wear logs
   * are present in the result with value 0, so the caller can index by id
   * without a fallback.
   */
  async countsByItems(itemIds: readonly string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const id of itemIds) out[id] = 0;
    if (itemIds.length === 0) return out;
    const rows = await db
      .select({
        itemId: schema.wearLogs.itemId,
        count: sql<number>`count(*)`,
      })
      .from(schema.wearLogs)
      .where(inArray(schema.wearLogs.itemId, itemIds as string[]))
      .groupBy(schema.wearLogs.itemId);
    for (const r of rows) {
      out[r.itemId] = Number(r.count);
    }
    return out;
  },

  /**
   * `day` (ローカル日付) の着用記録を item ごとに新しい順で返す。
   * countsByItems と同じく、記録のない item も空配列で結果に含む。
   */
  async listByItemsOnDay(
    itemIds: readonly string[],
    day: Date,
  ): Promise<Record<string, WearLog[]>> {
    const out: Record<string, WearLog[]> = {};
    for (const id of itemIds) out[id] = [];
    if (itemIds.length === 0) return out;
    const { from, to } = localDayRange(day);
    const rows = await db
      .select()
      .from(schema.wearLogs)
      .where(
        and(
          inArray(schema.wearLogs.itemId, itemIds as string[]),
          gte(schema.wearLogs.wornAt, from),
          lt(schema.wearLogs.wornAt, to),
        ),
      )
      .orderBy(desc(schema.wearLogs.wornAt));
    for (const row of rows) {
      out[row.itemId]?.push(toLog(row));
    }
    return out;
  },
};
