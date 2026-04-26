import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { CandidateEvaluation } from '@seam/shared';

type Row = typeof schema.candidateEvaluations.$inferSelect;
type Decision = CandidateEvaluation['decision'];

const toEvaluation = (row: Row): CandidateEvaluation => ({
  id: row.id,
  itemId: row.itemId,
  sizeScore: row.sizeScore,
  priceScore: row.priceScore,
  conditionScore: row.conditionScore,
  uniquenessScore: row.uniquenessScore,
  duplicateRiskScore: row.duplicateRiskScore,
  totalScore: row.totalScore,
  decision: row.decision as Decision,
  reason: row.reason ?? undefined,
  createdAt: row.createdAt,
});

export type EvaluationInput = Omit<CandidateEvaluation, 'id' | 'createdAt'>;

export const evaluationRepository = {
  async listByItem(itemId: string): Promise<CandidateEvaluation[]> {
    const rows = await db
      .select()
      .from(schema.candidateEvaluations)
      .where(eq(schema.candidateEvaluations.itemId, itemId))
      .orderBy(desc(schema.candidateEvaluations.createdAt));
    return rows.map(toEvaluation);
  },

  async create(input: EvaluationInput): Promise<CandidateEvaluation> {
    const row: Row = {
      id: newId(),
      itemId: input.itemId,
      sizeScore: input.sizeScore,
      priceScore: input.priceScore,
      conditionScore: input.conditionScore,
      uniquenessScore: input.uniquenessScore,
      duplicateRiskScore: input.duplicateRiskScore,
      totalScore: input.totalScore,
      decision: input.decision,
      reason: input.reason ?? null,
      createdAt: nowIso(),
    };
    await db.insert(schema.candidateEvaluations).values(row);
    return toEvaluation(row);
  },

  async latestByItem(itemId: string): Promise<CandidateEvaluation | null> {
    const rows = await db
      .select()
      .from(schema.candidateEvaluations)
      .where(eq(schema.candidateEvaluations.itemId, itemId))
      .orderBy(desc(schema.candidateEvaluations.createdAt))
      .limit(1);
    const row = rows[0];
    return row ? toEvaluation(row) : null;
  },

  async deleteByItem(itemId: string): Promise<void> {
    await db
      .delete(schema.candidateEvaluations)
      .where(eq(schema.candidateEvaluations.itemId, itemId));
  },
};
