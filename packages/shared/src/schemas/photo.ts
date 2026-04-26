import { z } from 'zod';

export const ItemPhotoSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  /** Relative path within app document directory. */
  relativePath: z.string(),
  /** Optional thumbnail relative path. */
  thumbnailRelativePath: z.string().optional(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type ItemPhoto = z.infer<typeof ItemPhotoSchema>;
