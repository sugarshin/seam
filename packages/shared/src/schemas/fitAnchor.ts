import { z } from 'zod';
import { GARMENT_CATEGORIES } from '../constants/categories';

export const FitAnchorSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  name: z.string().min(1),
  category: z.enum(GARMENT_CATEGORIES),
  notes: z.string().optional(),
  createdAt: z.string(),
});
export type FitAnchor = z.infer<typeof FitAnchorSchema>;
