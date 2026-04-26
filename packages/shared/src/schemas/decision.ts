import { z } from 'zod';

export const DecisionKindSchema = z.enum(['buy', 'watch', 'skip', 'lost_auction']);
export type DecisionKind = z.infer<typeof DecisionKindSchema>;

export const DecisionLogSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  decision: DecisionKindSchema,
  reason: z.string(),
  priceAtDecision: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
});
export type DecisionLog = z.infer<typeof DecisionLogSchema>;
