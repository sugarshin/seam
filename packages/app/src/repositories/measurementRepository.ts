import { eq } from 'drizzle-orm';
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
