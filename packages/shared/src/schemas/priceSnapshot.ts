import { z } from 'zod';

export const PriceSnapshotSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  price: z.number().int().nonnegative(),
  shippingFee: z.number().int().nonnegative().optional(),
  totalPrice: z.number().int().nonnegative().optional(),
  recordedAt: z.string(),
});
export type PriceSnapshot = z.infer<typeof PriceSnapshotSchema>;
