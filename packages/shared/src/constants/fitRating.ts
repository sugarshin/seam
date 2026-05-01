import type { FitRating } from '../schemas/item';

export const FIT_RATING_LABEL: Record<FitRating, string> = {
  too_small: '小さすぎ',
  just: 'ジャスト',
  slightly_large: '少し大きい',
  large: '大きめ',
  too_large: '大きすぎ',
};
