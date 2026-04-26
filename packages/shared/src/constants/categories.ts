export const GARMENT_CATEGORIES = [
  'hoodie',
  'sweatshirt',
  't_shirt',
  'shirt',
  'jacket',
  'coat',
  'pants',
  'shorts',
  'shoes',
  'bag',
  'accessory',
  'other',
] as const;

export type GarmentCategory = (typeof GARMENT_CATEGORIES)[number];

export const TOP_CATEGORIES: readonly GarmentCategory[] = [
  'hoodie',
  'sweatshirt',
  't_shirt',
  'shirt',
  'jacket',
  'coat',
];

export const PANTS_CATEGORIES: readonly GarmentCategory[] = ['pants', 'shorts'];

export const SHOES_CATEGORIES: readonly GarmentCategory[] = ['shoes'];

export const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  hoodie: 'パーカー',
  sweatshirt: 'スウェット',
  t_shirt: 'Tシャツ',
  shirt: 'シャツ',
  jacket: 'ジャケット',
  coat: 'コート',
  pants: 'パンツ',
  shorts: 'ショーツ',
  shoes: '靴',
  bag: 'バッグ',
  accessory: '小物',
  other: 'その他',
};

export type MeasurementCategoryGroup = 'top' | 'pants' | 'shoes' | 'none';

export const measurementGroupOf = (category: GarmentCategory): MeasurementCategoryGroup => {
  if (TOP_CATEGORIES.includes(category)) return 'top';
  if (PANTS_CATEGORIES.includes(category)) return 'pants';
  if (SHOES_CATEGORIES.includes(category)) return 'shoes';
  return 'none';
};
