import { z } from 'zod';

export const CandidateEvaluationSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  sizeScore: z.number().min(0).max(100),
  priceScore: z.number().min(0).max(100),
  conditionScore: z.number().min(0).max(100),
  uniquenessScore: z.number().min(0).max(100),
  duplicateRiskScore: z.number().min(0).max(100),
  totalScore: z.number().min(0).max(100),
  decision: z.enum(['buy', 'watch', 'skip']),
  reason: z.string().optional(),
  createdAt: z.string(),
});
export type CandidateEvaluation = z.infer<typeof CandidateEvaluationSchema>;
