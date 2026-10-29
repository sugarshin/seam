export const GARMENT_CATEGORIES = [
  // Tops
  'hoodie',
  'zip_hoodie',
  'sweatshirt',
  'knit',
  'cardigan',
  't_shirt',
  'long_sleeve_t_shirt',
  'thermal_long_sleeve_t_shirt',
  'tank_top',
  'short_sleeve_shirt',
  'long_sleeve_shirt',
  // Jackets (measured as tops)
  'denim_jacket',
  'swing_top',
  'coach_jacket',
  'nylon_jacket',
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
  'zip_hoodie',
  'sweatshirt',
  'knit',
  'cardigan',
  't_shirt',
  'long_sleeve_t_shirt',
  'thermal_long_sleeve_t_shirt',
  'tank_top',
  'short_sleeve_shirt',
  'long_sleeve_shirt',
  'denim_jacket',
  'swing_top',
  'coach_jacket',
  'nylon_jacket',
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
  zip_hoodie: 'ジップアップパーカー',
  sweatshirt: 'スウェット',
  knit: 'ニット',
  cardigan: 'カーディガン',
  t_shirt: 'Tシャツ',
  long_sleeve_t_shirt: 'L/S Tシャツ',
  thermal_long_sleeve_t_shirt: 'サーマル L/S T',
  tank_top: 'タンクトップ',
  short_sleeve_shirt: '半袖シャツ',
  long_sleeve_shirt: '長袖シャツ',
  denim_jacket: 'デニムジャケット',
  swing_top: 'スイングトップ',
  coach_jacket: 'コーチジャケット',
  nylon_jacket: 'ナイロンジャケット',
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

/**
 * Wardrobe-level grouping used by the Analytics screen. Unlike
 * `MeasurementCategoryGroup` (which lumps jackets into `top` because they are
 * measured the same way), this follows how the wardrobe is worn: outer
 * layers, tops, inner layers, bottoms and shoes. Bags / accessories fall
 * into `other`.
 */
export const MAJOR_CATEGORIES = ['outer', 'tops', 'inner', 'bottoms', 'shoes', 'other'] as const;

export type MajorCategory = (typeof MAJOR_CATEGORIES)[number];

export const MAJOR_CATEGORY_LABEL: Record<MajorCategory, string> = {
  outer: 'アウター',
  tops: 'トップス',
  inner: 'インナー',
  bottoms: 'ボトムス',
  shoes: 'シューズ',
  other: 'その他',
};

const MAJOR_CATEGORY_OF: Record<GarmentCategory, MajorCategory> = {
  hoodie: 'tops',
  zip_hoodie: 'tops',
  sweatshirt: 'tops',
  knit: 'tops',
  cardigan: 'tops',
  t_shirt: 'inner',
  long_sleeve_t_shirt: 'inner',
  thermal_long_sleeve_t_shirt: 'inner',
  tank_top: 'inner',
  short_sleeve_shirt: 'tops',
  long_sleeve_shirt: 'tops',
  denim_jacket: 'outer',
  swing_top: 'outer',
  coach_jacket: 'outer',
  nylon_jacket: 'outer',
  boa_jacket: 'outer',
  leather_jacket: 'outer',
  military_jacket: 'outer',
  mountain_parka: 'outer',
  tailored_jacket: 'outer',
  down_jacket: 'outer',
  other_jacket: 'outer',
  coat: 'outer',
  denim_pants: 'bottoms',
  slacks: 'bottoms',
  chino: 'bottoms',
  work_pants: 'bottoms',
  shorts: 'bottoms',
  sneakers: 'shoes',
  sandals: 'shoes',
  bag: 'other',
  accessory: 'other',
  other: 'other',
};

export const majorCategoryOf = (category: GarmentCategory): MajorCategory =>
  MAJOR_CATEGORY_OF[category];

/** Garment categories belonging to `major`, in `GARMENT_CATEGORIES` order. */
export const categoriesOfMajor = (major: MajorCategory): GarmentCategory[] =>
  GARMENT_CATEGORIES.filter((c) => MAJOR_CATEGORY_OF[c] === major);

export type MeasurementCategoryGroup = 'top' | 'pants' | 'shoes' | 'none';

export const measurementGroupOf = (category: GarmentCategory): MeasurementCategoryGroup => {
  if (TOP_CATEGORIES.includes(category)) return 'top';
  if (PANTS_CATEGORIES.includes(category)) return 'pants';
  if (SHOES_CATEGORIES.includes(category)) return 'shoes';
  return 'none';
};
