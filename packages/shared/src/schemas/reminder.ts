import { z } from 'zod';

export const ReminderSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  remindAt: z.string(),
  notificationId: z.string().optional(),
  isEnabled: z.boolean(),
  createdAt: z.string(),
});
export type Reminder = z.infer<typeof ReminderSchema>;
