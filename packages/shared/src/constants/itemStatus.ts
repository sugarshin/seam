/**
 * `bought` was removed; convert to `owned` immediately upon purchase.
 * `wishlist`: saved for later, no active monitoring.
 * `watching`: actively checking price/availability.
 * `bidding`: auction in progress.
 * `negotiating`: price negotiation ongoing.
 * `owned`: in user's wardrobe.
 * `skipped`: user decided not to buy.
 * `lost_auction`: auction ended without winning.
 * `sold`: previously owned, now sold.
 */
export const ITEM_STATUSES = [
  'wishlist',
  'watching',
  'bidding',
  'negotiating',
  'owned',
  'skipped',
  'lost_auction',
  'sold',
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  wishlist: '気になる',
  watching: 'ウォッチ中',
  bidding: '入札中',
  negotiating: '交渉中',
  owned: '所有中',
  skipped: '見送り',
  lost_auction: '落札失敗',
  sold: '売却済み',
};

export const CANDIDATE_STATUSES: readonly ItemStatus[] = [
  'wishlist',
  'watching',
  'bidding',
  'negotiating',
];

export const TERMINAL_STATUSES: readonly ItemStatus[] = ['skipped', 'lost_auction'];

const ALLOWED_TRANSITIONS: Record<ItemStatus, readonly ItemStatus[]> = {
  wishlist: ['watching', 'bidding', 'negotiating', 'owned', 'skipped'],
  watching: ['bidding', 'negotiating', 'owned', 'skipped'],
  bidding: ['owned', 'lost_auction', 'skipped'],
  negotiating: ['owned', 'skipped'],
  owned: ['sold'],
  skipped: ['wishlist'],
  lost_auction: ['wishlist'],
  sold: [],
};

export const canTransitionStatus = (from: ItemStatus, to: ItemStatus): boolean =>
  ALLOWED_TRANSITIONS[from].includes(to);

export const isCandidateStatus = (status: ItemStatus): boolean =>
  CANDIDATE_STATUSES.includes(status);
