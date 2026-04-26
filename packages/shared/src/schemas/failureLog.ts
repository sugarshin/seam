import { z } from 'zod';

export const FailureReasonSchema = z.enum([
  'too_small',
  'too_large',
  'too_short',
  'too_long',
  'bad_condition',
  'different_color',
  'bad_fabric',
  'duplicate',
  'not_worn',
  'other',
]);
export type FailureReason = z.infer<typeof FailureReasonSchema>;

export const FailureLogSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  result: z.enum(['success', 'mixed', 'failure']),
  reason: FailureReasonSchema,
  notes: z.string().optional(),
  createdAt: z.string(),
});
export type FailureLog = z.infer<typeof FailureLogSchema>;

export const FAILURE_REASON_LABEL: Record<FailureReason, string> = {
  too_small: 'サイズが小さい',
  too_large: 'サイズが大きい',
  too_short: '丈が短い',
  too_long: '丈が長い',
  bad_condition: '状態が悪い',
  different_color: '色が違う',
  bad_fabric: '生地が薄い・悪い',
  duplicate: '似た服を持っていた',
  not_worn: '着なかった',
  other: 'その他',
};
