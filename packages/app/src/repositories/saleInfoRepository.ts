import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import type { SaleInfo } from '@seam/shared';

type Row = typeof schema.saleInfos.$inferSelect;

const toSaleInfo = (row: Row): SaleInfo => ({
  itemId: row.itemId,
  soldPrice: row.soldPrice ?? undefined,
  soldAt: row.soldAt ?? undefined,
  soldSource: row.soldSource ?? undefined,
  notes: row.notes ?? undefined,
});

const toRow = (info: SaleInfo): Row => ({
  itemId: info.itemId,
  soldPrice: info.soldPrice ?? null,
  soldAt: info.soldAt ?? null,
  soldSource: info.soldSource ?? null,
  notes: info.notes ?? null,
});

export const saleInfoRepository = {
  async getByItemId(itemId: string): Promise<SaleInfo | null> {
    const rows = await db
      .select()
      .from(schema.saleInfos)
      .where(eq(schema.saleInfos.itemId, itemId))
      .limit(1);
    const row = rows[0];
    return row ? toSaleInfo(row) : null;
  },

  async upsert(info: SaleInfo): Promise<void> {
    const row = toRow(info);
    const existing = await db
      .select({ itemId: schema.saleInfos.itemId })
      .from(schema.saleInfos)
      .where(eq(schema.saleInfos.itemId, info.itemId))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(schema.saleInfos)
        .set(row)
        .where(eq(schema.saleInfos.itemId, info.itemId));
    } else {
      await db.insert(schema.saleInfos).values(row);
    }
  },

  async deleteByItemId(itemId: string): Promise<void> {
    await db.delete(schema.saleInfos).where(eq(schema.saleInfos.itemId, itemId));
  },
};
