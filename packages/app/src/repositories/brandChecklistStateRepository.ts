import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { BrandChecklistState } from '@seam/shared';

type Row = typeof schema.brandChecklistStates.$inferSelect;

const toState = (row: Row): BrandChecklistState => ({
  id: row.id,
  itemId: row.itemId,
  brandGuideId: row.brandGuideId,
  checklistItemKey: row.checklistItemKey,
  isChecked: row.isChecked,
  checkedAt: row.checkedAt === null ? undefined : row.checkedAt,
});

type ToggleInput = {
  itemId: string;
  brandGuideId: string;
  checklistItemKey: string;
  isChecked: boolean;
};

export const brandChecklistStateRepository = {
  async listForItemAndGuide(
    itemId: string,
    brandGuideId: string,
  ): Promise<BrandChecklistState[]> {
    const rows = await db
      .select()
      .from(schema.brandChecklistStates)
      .where(
        and(
          eq(schema.brandChecklistStates.itemId, itemId),
          eq(schema.brandChecklistStates.brandGuideId, brandGuideId),
        ),
      );
    return rows.map(toState);
  },

  async toggleItem(input: ToggleInput): Promise<void> {
    const existing = await db
      .select()
      .from(schema.brandChecklistStates)
      .where(
        and(
          eq(schema.brandChecklistStates.itemId, input.itemId),
          eq(schema.brandChecklistStates.brandGuideId, input.brandGuideId),
          eq(schema.brandChecklistStates.checklistItemKey, input.checklistItemKey),
        ),
      )
      .limit(1);
    const checkedAt = input.isChecked ? nowIso() : null;
    const found = existing[0];
    if (found) {
      await db
        .update(schema.brandChecklistStates)
        .set({ isChecked: input.isChecked, checkedAt })
        .where(eq(schema.brandChecklistStates.id, found.id));
      return;
    }
    await db.insert(schema.brandChecklistStates).values({
      id: newId(),
      itemId: input.itemId,
      brandGuideId: input.brandGuideId,
      checklistItemKey: input.checklistItemKey,
      isChecked: input.isChecked,
      checkedAt,
    });
  },

  async deleteForGuide(brandGuideId: string): Promise<void> {
    await db
      .delete(schema.brandChecklistStates)
      .where(eq(schema.brandChecklistStates.brandGuideId, brandGuideId));
  },

  async deleteForItem(itemId: string): Promise<void> {
    await db
      .delete(schema.brandChecklistStates)
      .where(eq(schema.brandChecklistStates.itemId, itemId));
  },
};
