import { asc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/dates';
import type { Reminder } from '@seam/shared';

type Row = typeof schema.reminders.$inferSelect;

const toReminder = (row: Row): Reminder => ({
  id: row.id,
  itemId: row.itemId,
  remindAt: row.remindAt,
  notificationId: row.notificationId ?? undefined,
  isEnabled: row.isEnabled,
  createdAt: row.createdAt,
});

export type ReminderInput = {
  itemId: string;
  remindAt: string;
  notificationId?: string;
  isEnabled: boolean;
};

export const reminderRepository = {
  async listByItem(itemId: string): Promise<Reminder[]> {
    const rows = await db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.itemId, itemId))
      .orderBy(asc(schema.reminders.remindAt));
    return rows.map(toReminder);
  },

  async listAllEnabled(): Promise<Reminder[]> {
    const rows = await db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.isEnabled, true))
      .orderBy(asc(schema.reminders.remindAt));
    return rows.map(toReminder);
  },

  async create(input: ReminderInput): Promise<Reminder> {
    const row: Row = {
      id: newId(),
      itemId: input.itemId,
      remindAt: input.remindAt,
      notificationId: input.notificationId ?? null,
      isEnabled: input.isEnabled,
      createdAt: nowIso(),
    };
    await db.insert(schema.reminders).values(row);
    return toReminder(row);
  },

  async update(id: string, patch: Partial<ReminderInput>): Promise<void> {
    const update: Partial<Row> = {};
    if (patch.itemId !== undefined) update.itemId = patch.itemId;
    if (patch.remindAt !== undefined) update.remindAt = patch.remindAt;
    if (patch.notificationId !== undefined) {
      update.notificationId = patch.notificationId ?? null;
    }
    if (patch.isEnabled !== undefined) update.isEnabled = patch.isEnabled;
    if (Object.keys(update).length === 0) return;
    await db.update(schema.reminders).set(update).where(eq(schema.reminders.id, id));
  },

  async delete(id: string): Promise<void> {
    await db.delete(schema.reminders).where(eq(schema.reminders.id, id));
  },

  async deleteByItem(itemId: string): Promise<void> {
    await db.delete(schema.reminders).where(eq(schema.reminders.itemId, itemId));
  },
};
