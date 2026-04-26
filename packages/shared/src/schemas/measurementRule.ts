import { z } from 'zod';
import { GARMENT_CATEGORIES } from '../constants/categories';
import { ALL_MEASUREMENT_KEYS } from '../constants/measurementKeys';

export const MeasurementRuleSchema = z.object({
  id: z.string(),
  category: z.enum(GARMENT_CATEGORIES),
  measurementKey: z.enum(ALL_MEASUREMENT_KEYS),
  operator: z.enum(['lt', 'lte', 'gt', 'gte']),
  value: z.number(),
  severity: z.enum(['warning', 'ng']),
  message: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MeasurementRule = z.infer<typeof MeasurementRuleSchema>;
