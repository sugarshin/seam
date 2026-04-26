import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { FitAnchor } from '@seam/shared';
import type { GarmentCategory } from '@seam/shared';

const toAnchor = (row: typeof schema.fitAnchors.$inferSelect): FitAnchor => ({
  id: row.id,
  itemId: row.itemId,
  name: row.name,
  category: row.category as GarmentCategory,
  notes: row.notes ?? undefined,
  createdAt: row.createdAt,
});

export const fitAnchorRepository = {
  async listByCategory(category: GarmentCategory): Promise<FitAnchor[]> {
    const rows = await db
      .select()
      .from(schema.fitAnchors)
      .where(eq(schema.fitAnchors.category, category));
    return rows.map(toAnchor);
  },

  async listAll(): Promise<FitAnchor[]> {
    const rows = await db.select().from(schema.fitAnchors);
    return rows.map(toAnchor);
  },

  async getByItemId(itemId: string): Promise<FitAnchor | null> {
    const rows = await db
      .select()
      .from(schema.fitAnchors)
      .where(eq(schema.fitAnchors.itemId, itemId))
      .limit(1);
    const row = rows[0];
    return row ? toAnchor(row) : null;
  },

  async create(input: Omit<FitAnchor, 'id' | 'createdAt'>): Promise<FitAnchor> {
    const row = {
      id: newId(),
      itemId: input.itemId,
      name: input.name,
      category: input.category,
      notes: input.notes ?? null,
      createdAt: nowIso(),
    };
    await db.insert(schema.fitAnchors).values(row);
    // also flag the item
    await db
      .update(schema.items)
      .set({ isFitAnchor: true, updatedAt: nowIso() })
      .where(eq(schema.items.id, input.itemId));
    return toAnchor(row);
  },

  async deleteByItemId(itemId: string): Promise<void> {
    await db.delete(schema.fitAnchors).where(eq(schema.fitAnchors.itemId, itemId));
    await db
      .update(schema.items)
      .set({ isFitAnchor: false, updatedAt: nowIso() })
      .where(eq(schema.items.id, itemId));
  },
};
