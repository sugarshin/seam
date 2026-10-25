import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import type { Measurement, MeasurementInput, MeasurementKey, MeasurementUnit } from '@seam/shared';

const toMeasurement = (row: typeof schema.measurements.$inferSelect): Measurement => ({
  id: row.id,
  itemId: row.itemId,
  key: row.key as MeasurementKey,
  value: row.value,
  unit: row.unit as MeasurementUnit,
});

export const measurementRepository = {
  async listByItem(itemId: string): Promise<Measurement[]> {
    const rows = await db
      .select()
      .from(schema.measurements)
      .where(eq(schema.measurements.itemId, itemId));
    return rows.map(toMeasurement);
  },

  /** Measurements for a set of items, grouped by item id (items without any are absent). */
  async listByItems(itemIds: readonly string[]): Promise<Record<string, Measurement[]>> {
    const out: Record<string, Measurement[]> = {};
    if (itemIds.length === 0) return out;
    const rows = await db
      .select()
      .from(schema.measurements)
      .where(inArray(schema.measurements.itemId, itemIds as string[]));
    for (const row of rows) {
      (out[row.itemId] ??= []).push(toMeasurement(row));
    }
    return out;
  },

  async upsertForItem(itemId: string, inputs: MeasurementInput[]): Promise<void> {
    await db.delete(schema.measurements).where(eq(schema.measurements.itemId, itemId));
    if (inputs.length === 0) return;
    await db.insert(schema.measurements).values(
      inputs.map((m) => ({
        id: newId(),
        itemId,
        key: m.key,
        value: m.value,
        unit: m.unit,
      })),
    );
  },

  async deleteByItem(itemId: string): Promise<void> {
    await db.delete(schema.measurements).where(eq(schema.measurements.itemId, itemId));
  },
};
