import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { Tag } from '@seam/shared';

const toTag = (row: typeof schema.tags.$inferSelect): Tag => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt,
});

export const tagRepository = {
  async listAll(): Promise<Tag[]> {
    const rows = await db.select().from(schema.tags);
    return rows.map(toTag);
  },

  async ensure(name: string): Promise<Tag> {
    const existing = await db.select().from(schema.tags).where(eq(schema.tags.name, name)).limit(1);
    const found = existing[0];
    if (found) return toTag(found);
    const row = { id: newId(), name, createdAt: nowIso() };
    await db.insert(schema.tags).values(row);
    return toTag(row);
  },

  async listForItem(itemId: string): Promise<Tag[]> {
    const rows = await db
      .select({ id: schema.tags.id, name: schema.tags.name, createdAt: schema.tags.createdAt })
      .from(schema.itemTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.itemTags.tagId))
      .where(eq(schema.itemTags.itemId, itemId));
    return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.createdAt }));
  },

  async setForItem(itemId: string, tagNames: readonly string[]): Promise<void> {
    const tags = await Promise.all(tagNames.map((n) => this.ensure(n)));
    await db.delete(schema.itemTags).where(eq(schema.itemTags.itemId, itemId));
    if (tags.length > 0) {
      await db.insert(schema.itemTags).values(tags.map((t) => ({ itemId, tagId: t.id })));
    }
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.tags).where(eq(schema.tags.id, id));
  },

  async findByNames(names: readonly string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    const rows = await db
      .select()
      .from(schema.tags)
      .where(inArray(schema.tags.name, [...names]));
    return rows.map(toTag);
  },

  async itemsWithTag(tagId: string): Promise<string[]> {
    const rows = await db
      .select({ itemId: schema.itemTags.itemId })
      .from(schema.itemTags)
      .where(eq(schema.itemTags.tagId, tagId));
    return rows.map((r) => r.itemId);
  },

  // helpers
  _itemHasTag: async (itemId: string, tagId: string): Promise<boolean> => {
    const rows = await db
      .select()
      .from(schema.itemTags)
      .where(and(eq(schema.itemTags.itemId, itemId), eq(schema.itemTags.tagId, tagId)))
      .limit(1);
    return rows.length > 0;
  },
};
