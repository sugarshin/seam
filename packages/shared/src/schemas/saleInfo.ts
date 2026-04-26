import { z } from 'zod';

export const SaleInfoSchema = z.object({
  itemId: z.string(),
  soldPrice: z.number().int().nonnegative().optional(),
  soldAt: z.string().optional(),
  soldSource: z.string().optional(),
  notes: z.string().optional(),
});
export type SaleInfo = z.infer<typeof SaleInfoSchema>;
