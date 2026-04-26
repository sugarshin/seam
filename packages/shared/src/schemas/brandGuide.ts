import { z } from 'zod';
import { GARMENT_CATEGORIES } from '../constants/categories';

export const BrandGuideSchema = z.object({
  id: z.string(),
  brand: z.string().min(1),
  category: z.enum(GARMENT_CATEGORIES).optional(),
  title: z.string().min(1),
  notes: z.string(),
  checklistItems: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BrandGuide = z.infer<typeof BrandGuideSchema>;

export const BrandChecklistStateSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  brandGuideId: z.string(),
  /** stable key derived from checklist text — survives reorder. */
  checklistItemKey: z.string(),
  isChecked: z.boolean(),
  checkedAt: z.string().optional(),
});
export type BrandChecklistState = z.infer<typeof BrandChecklistStateSchema>;
