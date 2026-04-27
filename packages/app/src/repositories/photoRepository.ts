import { asc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { ItemPhoto } from '@seam/shared';

const toPhoto = (row: typeof schema.photos.$inferSelect): ItemPhoto => ({
  id: row.id,
  itemId: row.itemId,
  relativePath: row.relativePath,
  thumbnailRelativePath: row.thumbnailRelativePath ?? undefined,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt,
});

export const photoRepository = {
  async listByItem(itemId: string): Promise<ItemPhoto[]> {
    const rows = await db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.itemId, itemId))
      .orderBy(asc(schema.photos.sortOrder));
    return rows.map(toPhoto);
  },

  async create(
    itemId: string,
    relativePath: string,
    thumbnailRelativePath: string | undefined,
    sortOrder: number,
  ): Promise<ItemPhoto> {
    const row = {
      id: newId(),
      itemId,
      relativePath,
      thumbnailRelativePath: thumbnailRelativePath ?? null,
      sortOrder,
      createdAt: nowIso(),
    };
    await db.insert(schema.photos).values(row);
    return toPhoto(row);
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.photos).where(eq(schema.photos.id, id));
  },

  async deleteByItem(itemId: string): Promise<void> {
    await db.delete(schema.photos).where(eq(schema.photos.itemId, itemId));
  },

  async reorder(itemId: string, orderedIds: readonly string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      if (!id) continue;

      await db.update(schema.photos).set({ sortOrder: i }).where(eq(schema.photos.id, id));
    }
    void itemId;
  },
};
