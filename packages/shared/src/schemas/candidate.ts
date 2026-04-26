import { z } from 'zod';
import { SOURCE_TYPES } from '../constants/sourceTypes';

export const CandidateInfoSchema = z.object({
  itemId: z.string(),
  sourceType: z.enum(SOURCE_TYPES),
  currentPrice: z.number().int().nonnegative().optional(),
  shippingFee: z.number().int().nonnegative().optional(),
  totalPrice: z.number().int().nonnegative().optional(),
  auctionEndsAt: z.string().optional(),
  easyBuyPrice: z.number().int().nonnegative().optional(),
  acceptablePrice: z.number().int().nonnegative().optional(),
  maxBidPrice: z.number().int().nonnegative().optional(),
  sellerName: z.string().optional(),
  listingDescription: z.string().optional(),
});
export type CandidateInfo = z.infer<typeof CandidateInfoSchema>;
