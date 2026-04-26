import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

const isoDate = () => text('').notNull();

// ─── items ──────────────────────────────────────────────────────────────────
export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    status: text('status').notNull(),
    name: text('name').notNull(),
    brand: text('brand'),
    modelName: text('model_name'),
    category: text('category').notNull(),
    color: text('color'),
    sizeLabel: text('size_label'),
    purchasePrice: integer('purchase_price'),
    shippingFee: integer('shipping_fee'),
    totalPrice: integer('total_price'),
    purchaseDate: text('purchase_date'),
    purchaseSource: text('purchase_source'),
    productUrl: text('product_url'),
    conditionRank: text('condition_rank'),
    conditionNotes: text('condition_notes'),
    fitRating: text('fit_rating'),
    favoriteScore: integer('favorite_score'),
    isFitAnchor: integer('is_fit_anchor', { mode: 'boolean' }).notNull().default(false),
    isSellCandidate: integer('is_sell_candidate', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    statusIdx: index('items_status_idx').on(table.status),
    categoryIdx: index('items_category_idx').on(table.category),
    brandIdx: index('items_brand_idx').on(table.brand),
  }),
);

// ─── measurements ────────────────────────────────────────────────────────────
export const measurements = sqliteTable(
  'measurements',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: real('value').notNull(),
    unit: text('unit').notNull(),
  },
  (table) => ({
    itemIdx: index('measurements_item_idx').on(table.itemId),
  }),
);

// ─── photos ──────────────────────────────────────────────────────────────────
export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    relativePath: text('relative_path').notNull(),
    thumbnailRelativePath: text('thumbnail_relative_path'),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    itemIdx: index('photos_item_idx').on(table.itemId),
  }),
);

// ─── fit_anchors ─────────────────────────────────────────────────────────────
export const fitAnchors = sqliteTable(
  'fit_anchors',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull(),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    categoryIdx: index('fit_anchors_category_idx').on(table.category),
  }),
);

// ─── candidate_infos (1:1 with items where status is candidate) ─────────────
export const candidateInfos = sqliteTable('candidate_infos', {
  itemId: text('item_id')
    .primaryKey()
    .references(() => items.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').notNull(),
  currentPrice: integer('current_price'),
  shippingFee: integer('shipping_fee'),
  totalPrice: integer('total_price'),
  auctionEndsAt: text('auction_ends_at'),
  easyBuyPrice: integer('easy_buy_price'),
  acceptablePrice: integer('acceptable_price'),
  maxBidPrice: integer('max_bid_price'),
  sellerName: text('seller_name'),
  listingDescription: text('listing_description'),
});

// ─── candidate_evaluations ───────────────────────────────────────────────────
export const candidateEvaluations = sqliteTable(
  'candidate_evaluations',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    sizeScore: integer('size_score').notNull(),
    priceScore: integer('price_score').notNull(),
    conditionScore: integer('condition_score').notNull(),
    uniquenessScore: integer('uniqueness_score').notNull(),
    duplicateRiskScore: integer('duplicate_risk_score').notNull(),
    totalScore: integer('total_score').notNull(),
    decision: text('decision').notNull(),
    reason: text('reason'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    itemIdx: index('candidate_evaluations_item_idx').on(table.itemId),
  }),
);

// ─── decision_logs ───────────────────────────────────────────────────────────
export const decisionLogs = sqliteTable(
  'decision_logs',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    decision: text('decision').notNull(),
    reason: text('reason').notNull(),
    priceAtDecision: integer('price_at_decision'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    itemIdx: index('decision_logs_item_idx').on(table.itemId),
  }),
);

// ─── failure_logs ────────────────────────────────────────────────────────────
export const failureLogs = sqliteTable(
  'failure_logs',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    result: text('result').notNull(),
    reason: text('reason').notNull(),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    itemIdx: index('failure_logs_item_idx').on(table.itemId),
  }),
);

// ─── measurement_rules ───────────────────────────────────────────────────────
export const measurementRules = sqliteTable(
  'measurement_rules',
  {
    id: text('id').primaryKey(),
    category: text('category').notNull(),
    measurementKey: text('measurement_key').notNull(),
    operator: text('operator').notNull(),
    value: real('value').notNull(),
    severity: text('severity').notNull(),
    message: text('message').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    catKeyIdx: index('measurement_rules_cat_key_idx').on(table.category, table.measurementKey),
  }),
);

// ─── brand_guides ────────────────────────────────────────────────────────────
export const brandGuides = sqliteTable(
  'brand_guides',
  {
    id: text('id').primaryKey(),
    brand: text('brand').notNull(),
    category: text('category'),
    title: text('title').notNull(),
    notes: text('notes').notNull(),
    /** JSON-encoded string[] */
    checklistItems: text('checklist_items').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    brandIdx: index('brand_guides_brand_idx').on(table.brand),
  }),
);

export const brandChecklistStates = sqliteTable(
  'brand_checklist_states',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    brandGuideId: text('brand_guide_id')
      .notNull()
      .references(() => brandGuides.id, { onDelete: 'cascade' }),
    checklistItemKey: text('checklist_item_key').notNull(),
    isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
    checkedAt: text('checked_at'),
  },
  (table) => ({
    itemGuideIdx: index('brand_checklist_states_item_guide_idx').on(
      table.itemId,
      table.brandGuideId,
    ),
  }),
);

// ─── wear_logs ───────────────────────────────────────────────────────────────
export const wearLogs = sqliteTable(
  'wear_logs',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    wornAt: text('worn_at').notNull(),
    notes: text('notes'),
  },
  (table) => ({
    itemIdx: index('wear_logs_item_idx').on(table.itemId),
  }),
);

// ─── sale_infos (1:1) ────────────────────────────────────────────────────────
export const saleInfos = sqliteTable('sale_infos', {
  itemId: text('item_id')
    .primaryKey()
    .references(() => items.id, { onDelete: 'cascade' }),
  soldPrice: integer('sold_price'),
  soldAt: text('sold_at'),
  soldSource: text('sold_source'),
  notes: text('notes'),
});

// ─── price_snapshots ─────────────────────────────────────────────────────────
export const priceSnapshots = sqliteTable(
  'price_snapshots',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    price: integer('price').notNull(),
    shippingFee: integer('shipping_fee'),
    totalPrice: integer('total_price'),
    recordedAt: text('recorded_at').notNull(),
  },
  (table) => ({
    itemIdx: index('price_snapshots_item_idx').on(table.itemId),
  }),
);

// ─── tags ────────────────────────────────────────────────────────────────────
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull(),
});

export const itemTags = sqliteTable(
  'item_tags',
  {
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.itemId, table.tagId] }),
  }),
);

// ─── reminders ───────────────────────────────────────────────────────────────
export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    remindAt: text('remind_at').notNull(),
    notificationId: text('notification_id'),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    itemIdx: index('reminders_item_idx').on(table.itemId),
  }),
);

// silence unused-import
void isoDate;
