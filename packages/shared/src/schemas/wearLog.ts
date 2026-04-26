import { z } from 'zod';

export const WearLogSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  wornAt: z.string(),
  notes: z.string().optional(),
});
export type WearLog = z.infer<typeof WearLogSchema>;
