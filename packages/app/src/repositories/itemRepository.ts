import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { GarmentItem, ItemStatus } from '@seam/shared';
import { CANDIDATE_STATUSES } from '@seam/shared';

export type ItemRow = typeof schema.items.$inferSelect;

const toGarmentItem = (row: ItemRow): GarmentItem =>
  ({
    ...row,
    brand: row.brand ?? undefined,
    modelName: row.modelName ?? undefined,
    color: row.color ?? undefined,
    sizeLabel: row.sizeLabel ?? undefined,
    purchasePrice: row.purchasePrice ?? undefined,
    shippingFee: row.shippingFee ?? undefined,
    totalPrice: row.totalPrice ?? undefined,
    purchaseDate: row.purchaseDate ?? undefined,
    purchaseSource: row.purchaseSource ?? undefined,
    productUrl: row.productUrl ?? undefined,
    conditionRank: (row.conditionRank ?? undefined) as GarmentItem['conditionRank'],
    conditionNotes: row.conditionNotes ?? undefined,
    fitRating: (row.fitRating ?? undefined) as GarmentItem['fitRating'],
    favoriteScore: (row.favoriteScore ?? undefined) as GarmentItem['favoriteScore'],
    notes: row.notes ?? undefined,
    status: row.status as ItemStatus,
    category: row.category as GarmentItem['category'],
  }) as GarmentItem;

export type ItemFilter = {
  statuses?: readonly ItemStatus[];
  categories?: readonly GarmentItem['category'][];
  brand?: string;
  isFitAnchor?: boolean;
  isSellCandidate?: boolean;
  search?: string;
};

export type ItemSort =
  | 'createdAt_desc'
  | 'purchaseDate_desc'
  | 'purchasePrice_desc'
  | 'favoriteScore_desc'
  | 'category_asc'
  | 'brand_asc';

const orderByFor = (sort: ItemSort) => {
  switch (sort) {
    case 'createdAt_desc':
      return desc(schema.items.createdAt);
    case 'purchaseDate_desc':
      return desc(schema.items.purchaseDate);
    case 'purchasePrice_desc':
      return desc(schema.items.purchasePrice);
    case 'favoriteScore_desc':
      return desc(schema.items.favoriteScore);
    case 'category_asc':
      return schema.items.category;
    case 'brand_asc':
      return schema.items.brand;
  }
};

export const itemRepository = {
  async list(filter: ItemFilter = {}, sort: ItemSort = 'createdAt_desc'): Promise<GarmentItem[]> {
    const conditions = [];
    if (filter.statuses && filter.statuses.length > 0) {
      conditions.push(inArray(schema.items.status, filter.statuses as string[]));
    }
    if (filter.categories && filter.categories.length > 0) {
      conditions.push(inArray(schema.items.category, filter.categories as string[]));
    }
    if (filter.brand) {
      conditions.push(eq(schema.items.brand, filter.brand));
    }
    if (filter.isFitAnchor !== undefined) {
      conditions.push(eq(schema.items.isFitAnchor, filter.isFitAnchor));
    }
    if (filter.isSellCandidate !== undefined) {
      conditions.push(eq(schema.items.isSellCandidate, filter.isSellCandidate));
    }
    if (filter.search) {
      const q = `%${filter.search}%`;
      conditions.push(
        or(
          like(schema.items.name, q),
          like(schema.items.brand, q),
          like(schema.items.modelName, q),
          like(schema.items.notes, q),
          like(schema.items.color, q),
        ),
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select().from(schema.items).where(where).orderBy(orderByFor(sort));
    return rows.map(toGarmentItem);
  },

  async listCandidates(): Promise<GarmentItem[]> {
    return this.list({ statuses: CANDIDATE_STATUSES });
  },

  async listOwned(): Promise<GarmentItem[]> {
    return this.list({ statuses: ['owned'] });
  },

  async getById(id: string): Promise<GarmentItem | null> {
    const rows = await db.select().from(schema.items).where(eq(schema.items.id, id)).limit(1);
    const row = rows[0];
    return row ? toGarmentItem(row) : null;
  },

  async create(input: Omit<GarmentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<GarmentItem> {
    const id = newId();
    const ts = nowIso();
    const row: ItemRow = {
      id,
      status: input.status,
      name: input.name,
      brand: input.brand ?? null,
      modelName: input.modelName ?? null,
      category: input.category,
      color: input.color ?? null,
      sizeLabel: input.sizeLabel ?? null,
      purchasePrice: input.purchasePrice ?? null,
      shippingFee: input.shippingFee ?? null,
      totalPrice: input.totalPrice ?? null,
      purchaseDate: input.purchaseDate ?? null,
      purchaseSource: input.purchaseSource ?? null,
      productUrl: input.productUrl ?? null,
      conditionRank: input.conditionRank ?? null,
      conditionNotes: input.conditionNotes ?? null,
      fitRating: input.fitRating ?? null,
      favoriteScore: input.favoriteScore ?? null,
      isFitAnchor: input.isFitAnchor,
      isSellCandidate: input.isSellCandidate,
      notes: input.notes ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    await db.insert(schema.items).values(row);
    return toGarmentItem(row);
  },

  async update(id: string, patch: Partial<Omit<GarmentItem, 'id' | 'createdAt'>>): Promise<void> {
    const update: Partial<ItemRow> = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.brand !== undefined) update.brand = patch.brand ?? null;
    if (patch.modelName !== undefined) update.modelName = patch.modelName ?? null;
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.color !== undefined) update.color = patch.color ?? null;
    if (patch.sizeLabel !== undefined) update.sizeLabel = patch.sizeLabel ?? null;
    if (patch.purchasePrice !== undefined) update.purchasePrice = patch.purchasePrice ?? null;
    if (patch.shippingFee !== undefined) update.shippingFee = patch.shippingFee ?? null;
    if (patch.totalPrice !== undefined) update.totalPrice = patch.totalPrice ?? null;
    if (patch.purchaseDate !== undefined) update.purchaseDate = patch.purchaseDate ?? null;
    if (patch.purchaseSource !== undefined) update.purchaseSource = patch.purchaseSource ?? null;
    if (patch.productUrl !== undefined) update.productUrl = patch.productUrl ?? null;
    if (patch.conditionRank !== undefined) update.conditionRank = patch.conditionRank ?? null;
    if (patch.conditionNotes !== undefined) update.conditionNotes = patch.conditionNotes ?? null;
    if (patch.fitRating !== undefined) update.fitRating = patch.fitRating ?? null;
    if (patch.favoriteScore !== undefined) update.favoriteScore = patch.favoriteScore ?? null;
    if (patch.isFitAnchor !== undefined) update.isFitAnchor = patch.isFitAnchor;
    if (patch.isSellCandidate !== undefined) update.isSellCandidate = patch.isSellCandidate;
    if (patch.notes !== undefined) update.notes = patch.notes ?? null;
    update.updatedAt = nowIso();
    await db.update(schema.items).set(update).where(eq(schema.items.id, id));
  },

  async setStatus(id: string, status: ItemStatus): Promise<void> {
    await db
      .update(schema.items)
      .set({ status, updatedAt: nowIso() })
      .where(eq(schema.items.id, id));
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.items).where(eq(schema.items.id, id));
  },

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await db
      .select({
        status: schema.items.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.items)
      .groupBy(schema.items.status);
    return Object.fromEntries(rows.map((r) => [r.status, r.count]));
  },
};
