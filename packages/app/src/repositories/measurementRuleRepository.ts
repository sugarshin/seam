import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { GarmentCategory, MeasurementKey, MeasurementRule } from '@seam/shared';

type Row = typeof schema.measurementRules.$inferSelect;

const toRule = (row: Row): MeasurementRule => ({
  id: row.id,
  category: row.category as GarmentCategory,
  measurementKey: row.measurementKey as MeasurementKey,
  operator: row.operator as MeasurementRule['operator'],
  value: row.value,
  severity: row.severity as MeasurementRule['severity'],
  message: row.message,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const measurementRuleRepository = {
  async listAll(): Promise<MeasurementRule[]> {
    const rows = await db
      .select()
      .from(schema.measurementRules)
      .orderBy(asc(schema.measurementRules.category), asc(schema.measurementRules.measurementKey));
    return rows.map(toRule);
  },

  async listByCategory(category: GarmentCategory): Promise<MeasurementRule[]> {
    const rows = await db
      .select()
      .from(schema.measurementRules)
      .where(eq(schema.measurementRules.category, category))
      .orderBy(asc(schema.measurementRules.measurementKey));
    return rows.map(toRule);
  },

  async getById(id: string): Promise<MeasurementRule | null> {
    const rows = await db
      .select()
      .from(schema.measurementRules)
      .where(eq(schema.measurementRules.id, id))
      .limit(1);
    const row = rows[0];
    return row ? toRule(row) : null;
  },

  async create(
    input: Omit<MeasurementRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MeasurementRule> {
    const id = newId();
    const ts = nowIso();
    const row: Row = {
      id,
      category: input.category,
      measurementKey: input.measurementKey,
      operator: input.operator,
      value: input.value,
      severity: input.severity,
      message: input.message,
      createdAt: ts,
      updatedAt: ts,
    };
    await db.insert(schema.measurementRules).values(row);
    return toRule(row);
  },

  async update(
    id: string,
    patch: Partial<Omit<MeasurementRule, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const update: Partial<Row> = {};
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.measurementKey !== undefined) update.measurementKey = patch.measurementKey;
    if (patch.operator !== undefined) update.operator = patch.operator;
    if (patch.value !== undefined) update.value = patch.value;
    if (patch.severity !== undefined) update.severity = patch.severity;
    if (patch.message !== undefined) update.message = patch.message;
    update.updatedAt = nowIso();
    await db.update(schema.measurementRules).set(update).where(eq(schema.measurementRules.id, id));
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.measurementRules).where(eq(schema.measurementRules.id, id));
  },

  async deleteByCategoryAndKey(
    category: GarmentCategory,
    measurementKey: MeasurementKey,
  ): Promise<void> {
    await db
      .delete(schema.measurementRules)
      .where(
        and(
          eq(schema.measurementRules.category, category),
          eq(schema.measurementRules.measurementKey, measurementKey),
        ),
      );
  },
};
