// Re-export inferred types from schemas for convenience.
export type {
  GarmentItem,
  GarmentItemInput,
  FitRating,
  FavoriteScore,
} from '../schemas/item';
export type { Measurement, MeasurementInput } from '../schemas/measurement';
export type { ItemPhoto } from '../schemas/photo';
export type { FitAnchor } from '../schemas/fitAnchor';
export type { CandidateInfo } from '../schemas/candidate';
export type { DecisionKind, DecisionLog } from '../schemas/decision';
export type { CandidateEvaluation } from '../schemas/score';
export type { MeasurementRule } from '../schemas/measurementRule';
export type { BrandGuide, BrandChecklistState } from '../schemas/brandGuide';
export type { WearLog } from '../schemas/wearLog';
export type { FailureReason, FailureLog } from '../schemas/failureLog';
export type { SaleInfo } from '../schemas/saleInfo';
export type { PriceSnapshot } from '../schemas/priceSnapshot';
export type { Tag, ItemTag } from '../schemas/tag';
export type { Reminder } from '../schemas/reminder';
