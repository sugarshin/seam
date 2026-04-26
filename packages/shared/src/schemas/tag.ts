import { z } from 'zod';

export const TagSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.string(),
});
export type Tag = z.infer<typeof TagSchema>;

export const ItemTagSchema = z.object({
  itemId: z.string(),
  tagId: z.string(),
});
export type ItemTag = z.infer<typeof ItemTagSchema>;
