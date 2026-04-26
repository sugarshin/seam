import { z } from 'zod';
import { ALL_MEASUREMENT_KEYS, MEASUREMENT_UNITS } from '../constants/measurementKeys';

export const MeasurementSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  key: z.enum(ALL_MEASUREMENT_KEYS),
  value: z.number().positive(),
  unit: z.enum(MEASUREMENT_UNITS),
});
export type Measurement = z.infer<typeof MeasurementSchema>;

export const MeasurementInputSchema = MeasurementSchema.omit({ id: true });
export type MeasurementInput = z.infer<typeof MeasurementInputSchema>;
