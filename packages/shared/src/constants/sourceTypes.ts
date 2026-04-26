export const SOURCE_TYPES = [
  'yahoo_auction',
  'mercari',
  'rakuma',
  'ebay',
  'online_store',
  'physical_store',
  'other',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  yahoo_auction: 'ヤフオク',
  mercari: 'メルカリ',
  rakuma: 'ラクマ',
  ebay: 'eBay',
  online_store: 'オンライン',
  physical_store: '実店舗',
  other: 'その他',
};
