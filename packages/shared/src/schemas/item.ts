import { z } from 'zod';
import { GARMENT_CATEGORIES } from '../constants/categories';
import { ITEM_STATUSES } from '../constants/itemStatus';
import { CONDITION_RANKS, type ConditionRank } from '../constants/scoreWeights';

export const FitRatingSchema = z.enum([
  'too_small',
  'just',
  'slightly_large',
  'large',
  'too_large',
]);
export type FitRating = z.infer<typeof FitRatingSchema>;

export const FavoriteScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type FavoriteScore = z.infer<typeof FavoriteScoreSchema>;

export const GarmentItemSchema = z.object({
  id: z.string(),
  status: z.enum(ITEM_STATUSES),
  name: z.string().min(1),
  brand: z.string().optional(),
  modelName: z.string().optional(),
  category: z.enum(GARMENT_CATEGORIES),
  color: z.string().optional(),
  sizeLabel: z.string().optional(),
  purchasePrice: z.number().int().nonnegative().optional(),
  shippingFee: z.number().int().nonnegative().optional(),
  totalPrice: z.number().int().nonnegative().optional(),
  purchaseDate: z.string().optional(),
  purchaseSource: z.string().optional(),
  productUrl: z.string().url().optional().or(z.literal('')),
  conditionRank: z.enum(CONDITION_RANKS as readonly [ConditionRank, ...ConditionRank[]]).optional(),
  conditionNotes: z.string().optional(),
  fitRating: FitRatingSchema.optional(),
  favoriteScore: FavoriteScoreSchema.optional(),
  isFitAnchor: z.boolean().default(false),
  isSellCandidate: z.boolean().default(false),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GarmentItem = z.infer<typeof GarmentItemSchema>;

export const GarmentItemInputSchema = GarmentItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GarmentItemInput = z.infer<typeof GarmentItemInputSchema>;
