import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { PriceSnapshot } from '@seam/shared';
import { calculateTotalPrice } from '@seam/domain/pricing';

const toSnapshot = (row: typeof schema.priceSnapshots.$inferSelect): PriceSnapshot => ({
  id: row.id,
  itemId: row.itemId,
  price: row.price,
  shippingFee: row.shippingFee ?? undefined,
  totalPrice: row.totalPrice ?? undefined,
  recordedAt: row.recordedAt,
});

export const priceSnapshotRepository = {
  async listByItem(itemId: string): Promise<PriceSnapshot[]> {
    const rows = await db
      .select()
      .from(schema.priceSnapshots)
      .where(eq(schema.priceSnapshots.itemId, itemId))
      .orderBy(desc(schema.priceSnapshots.recordedAt));
    return rows.map(toSnapshot);
  },

  async create(
    itemId: string,
    price: number,
    shippingFee?: number,
    totalPrice?: number,
  ): Promise<PriceSnapshot> {
    const computedTotal = totalPrice ?? calculateTotalPrice(price, shippingFee);
    const row = {
      id: newId(),
      itemId,
      price,
      shippingFee: shippingFee ?? null,
      totalPrice: computedTotal,
      recordedAt: nowIso(),
    };
    await db.insert(schema.priceSnapshots).values(row);
    return toSnapshot(row);
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.priceSnapshots).where(eq(schema.priceSnapshots.id, id));
  },

  async deleteByItem(itemId: string): Promise<void> {
    await db.delete(schema.priceSnapshots).where(eq(schema.priceSnapshots.itemId, itemId));
  },
};
