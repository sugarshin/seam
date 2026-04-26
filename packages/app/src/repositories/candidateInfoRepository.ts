import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import type { CandidateInfo, SourceType } from '@seam/shared';

type Row = typeof schema.candidateInfos.$inferSelect;

const toCandidateInfo = (row: Row): CandidateInfo => ({
  itemId: row.itemId,
  sourceType: row.sourceType as SourceType,
  currentPrice: row.currentPrice ?? undefined,
  shippingFee: row.shippingFee ?? undefined,
  totalPrice: row.totalPrice ?? undefined,
  auctionEndsAt: row.auctionEndsAt ?? undefined,
  easyBuyPrice: row.easyBuyPrice ?? undefined,
  acceptablePrice: row.acceptablePrice ?? undefined,
  maxBidPrice: row.maxBidPrice ?? undefined,
  sellerName: row.sellerName ?? undefined,
  listingDescription: row.listingDescription ?? undefined,
});

const toRow = (info: CandidateInfo): Row => ({
  itemId: info.itemId,
  sourceType: info.sourceType,
  currentPrice: info.currentPrice ?? null,
  shippingFee: info.shippingFee ?? null,
  totalPrice: info.totalPrice ?? null,
  auctionEndsAt: info.auctionEndsAt ?? null,
  easyBuyPrice: info.easyBuyPrice ?? null,
  acceptablePrice: info.acceptablePrice ?? null,
  maxBidPrice: info.maxBidPrice ?? null,
  sellerName: info.sellerName ?? null,
  listingDescription: info.listingDescription ?? null,
});

export const candidateInfoRepository = {
  async getByItemId(itemId: string): Promise<CandidateInfo | null> {
    const rows = await db
      .select()
      .from(schema.candidateInfos)
      .where(eq(schema.candidateInfos.itemId, itemId))
      .limit(1);
    const row = rows[0];
    return row ? toCandidateInfo(row) : null;
  },

  async upsert(info: CandidateInfo): Promise<void> {
    const row = toRow(info);
    const existing = await db
      .select({ itemId: schema.candidateInfos.itemId })
      .from(schema.candidateInfos)
      .where(eq(schema.candidateInfos.itemId, info.itemId))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(schema.candidateInfos)
        .set(row)
        .where(eq(schema.candidateInfos.itemId, info.itemId));
    } else {
      await db.insert(schema.candidateInfos).values(row);
    }
  },

  async deleteByItemId(itemId: string): Promise<void> {
    await db.delete(schema.candidateInfos).where(eq(schema.candidateInfos.itemId, itemId));
  },
};
