import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { DecisionKind, DecisionLog } from '@seam/shared';

type Row = typeof schema.decisionLogs.$inferSelect;

const toLog = (row: Row): DecisionLog => ({
  id: row.id,
  itemId: row.itemId,
  decision: row.decision as DecisionKind,
  reason: row.reason,
  priceAtDecision: row.priceAtDecision ?? undefined,
  createdAt: row.createdAt,
});

export type DecisionLogInput = {
  itemId: string;
  decision: DecisionKind;
  reason: string;
  priceAtDecision?: number;
};

const ALL_DECISIONS: readonly DecisionKind[] = ['buy', 'watch', 'skip', 'lost_auction'];

export const decisionLogRepository = {
  async listByItem(itemId: string): Promise<DecisionLog[]> {
    const rows = await db
      .select()
      .from(schema.decisionLogs)
      .where(eq(schema.decisionLogs.itemId, itemId))
      .orderBy(desc(schema.decisionLogs.createdAt));
    return rows.map(toLog);
  },

  async listAll(): Promise<DecisionLog[]> {
    const rows = await db
      .select()
      .from(schema.decisionLogs)
      .orderBy(desc(schema.decisionLogs.createdAt));
    return rows.map(toLog);
  },

  async create(input: DecisionLogInput): Promise<DecisionLog> {
    const row: Row = {
      id: newId(),
      itemId: input.itemId,
      decision: input.decision,
      reason: input.reason,
      priceAtDecision: input.priceAtDecision ?? null,
      createdAt: nowIso(),
    };
    await db.insert(schema.decisionLogs).values(row);
    return toLog(row);
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.decisionLogs).where(eq(schema.decisionLogs.id, id));
  },

  async countByDecision(): Promise<Record<DecisionKind, number>> {
    const rows = await db
      .select({
        decision: schema.decisionLogs.decision,
        count: sql<number>`count(*)`,
      })
      .from(schema.decisionLogs)
      .groupBy(schema.decisionLogs.decision);
    const out: Record<DecisionKind, number> = ALL_DECISIONS.reduce(
      (acc, k) => {
        acc[k] = 0;
        return acc;
      },
      {} as Record<DecisionKind, number>,
    );
    for (const r of rows) {
      const d = r.decision as DecisionKind;
      if (ALL_DECISIONS.includes(d)) out[d] = Number(r.count);
    }
    return out;
  },
};
