import { desc, eq, inArray, sql } from 'drizzle-orm';
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
};
