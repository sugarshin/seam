import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { FailureLog, FailureReason } from '@seam/shared';

type Row = typeof schema.failureLogs.$inferSelect;

type FailureResult = FailureLog['result'];

const ALL_REASONS: readonly FailureReason[] = [
  'too_small',
  'too_large',
  'too_short',
  'too_long',
  'bad_condition',
  'different_color',
  'bad_fabric',
  'duplicate',
  'not_worn',
  'other',
];

const toLog = (row: Row): FailureLog => ({
  id: row.id,
  itemId: row.itemId,
  result: row.result as FailureResult,
  reason: row.reason as FailureReason,
  notes: row.notes ?? undefined,
  createdAt: row.createdAt,
});

export type FailureLogInput = {
  itemId: string;
  result: FailureResult;
  reason: FailureReason;
  notes?: string;
};

export const failureLogRepository = {
  async listByItem(itemId: string): Promise<FailureLog[]> {
    const rows = await db
      .select()
      .from(schema.failureLogs)
      .where(eq(schema.failureLogs.itemId, itemId))
      .orderBy(desc(schema.failureLogs.createdAt));
    return rows.map(toLog);
  },

  async listAll(): Promise<FailureLog[]> {
    const rows = await db
      .select()
      .from(schema.failureLogs)
      .orderBy(desc(schema.failureLogs.createdAt));
    return rows.map(toLog);
  },

  async create(input: FailureLogInput): Promise<FailureLog> {
    const row: Row = {
      id: newId(),
      itemId: input.itemId,
      result: input.result,
      reason: input.reason,
      notes: input.notes ?? null,
      createdAt: nowIso(),
    };
    await db.insert(schema.failureLogs).values(row);
    return toLog(row);
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.failureLogs).where(eq(schema.failureLogs.id, id));
  },

  async deleteByItem(itemId: string): Promise<void> {
    await db.delete(schema.failureLogs).where(eq(schema.failureLogs.itemId, itemId));
  },

  async countAll(): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.failureLogs);
    return Number(rows[0]?.count ?? 0);
  },

  /**
   * Returns a fully populated record (every reason key present, missing → 0)
   * so the Stats screen does not need to special-case absent reasons.
   */
  async countByReason(): Promise<Record<FailureReason, number>> {
    const rows = await db
      .select({
        reason: schema.failureLogs.reason,
        count: sql<number>`count(*)`,
      })
      .from(schema.failureLogs)
      .groupBy(schema.failureLogs.reason);

    const out: Record<FailureReason, number> = ALL_REASONS.reduce(
      (acc, r) => {
        acc[r] = 0;
        return acc;
      },
      {} as Record<FailureReason, number>,
    );
    for (const r of rows) {
      const key = r.reason as FailureReason;
      if (ALL_REASONS.includes(key)) out[key] = Number(r.count);
    }
    return out;
  },
};
