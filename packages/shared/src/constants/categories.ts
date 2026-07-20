export const GARMENT_CATEGORIES = [
  // Tops
  'hoodie',
  'sweatshirt',
  'cardigan',
  't_shirt',
  'tank_top',
  'short_sleeve_shirt',
  'long_sleeve_shirt',
  // Jackets (measured as tops)
  'denim_jacket',
  'swing_top',
  'coach_jacket',
  'boa_jacket',
  'leather_jacket',
  'military_jacket',
  'mountain_parka',
  'tailored_jacket',
  'down_jacket',
  'other_jacket',
  'coat',
  // Pants
  'denim_pants',
  'slacks',
  'chino',
  'work_pants',
  'shorts',
  // Shoes
  'sneakers',
  'sandals',
  // Other
  'bag',
  'accessory',
  'other',
] as const;

export type GarmentCategory = (typeof GARMENT_CATEGORIES)[number];

export const TOP_CATEGORIES: readonly GarmentCategory[] = [
  'hoodie',
  'sweatshirt',
  'cardigan',
  't_shirt',
  'tank_top',
  'short_sleeve_shirt',
  'long_sleeve_shirt',
  'denim_jacket',
  'swing_top',
  'coach_jacket',
  'boa_jacket',
  'leather_jacket',
  'military_jacket',
  'mountain_parka',
  'tailored_jacket',
  'down_jacket',
  'other_jacket',
  'coat',
];

export const PANTS_CATEGORIES: readonly GarmentCategory[] = [
  'denim_pants',
  'slacks',
  'chino',
  'work_pants',
  'shorts',
];

export const SHOES_CATEGORIES: readonly GarmentCategory[] = ['sneakers', 'sandals'];

export const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  hoodie: 'パーカー',
  sweatshirt: 'スウェット',
  cardigan: 'カーディガン',
  t_shirt: 'Tシャツ',
  tank_top: 'タンクトップ',
  short_sleeve_shirt: '半袖シャツ',
  long_sleeve_shirt: '長袖シャツ',
  denim_jacket: 'デニムジャケット',
  swing_top: 'スイングトップ',
  coach_jacket: 'コーチジャケット',
  boa_jacket: 'ボアジャケット',
  leather_jacket: 'レザージャケット',
  military_jacket: 'ミリタリージャケット',
  mountain_parka: 'マウンテンパーカー',
  tailored_jacket: 'テーラードジャケット',
  down_jacket: 'ダウンジャケット',
  other_jacket: 'その他ジャケット',
  coat: 'コート',
  denim_pants: 'デニム',
  slacks: 'スラックス',
  chino: 'チノ',
  work_pants: 'ワークパンツ',
  shorts: 'ショーツ',
  sneakers: 'スニーカー',
  sandals: 'サンダル',
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
