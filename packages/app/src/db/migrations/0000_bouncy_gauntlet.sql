CREATE TABLE `brand_checklist_states` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`brand_guide_id` text NOT NULL,
	`checklist_item_key` text NOT NULL,
	`is_checked` integer DEFAULT false NOT NULL,
	`checked_at` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`brand_guide_id`) REFERENCES `brand_guides`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `brand_checklist_states_item_guide_idx` ON `brand_checklist_states` (`item_id`,`brand_guide_id`);--> statement-breakpoint
CREATE TABLE `brand_guides` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`category` text,
	`title` text NOT NULL,
	`notes` text NOT NULL,
	`checklist_items` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brand_guides_brand_idx` ON `brand_guides` (`brand`);--> statement-breakpoint
CREATE TABLE `candidate_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`size_score` integer NOT NULL,
	`price_score` integer NOT NULL,
	`condition_score` integer NOT NULL,
	`uniqueness_score` integer NOT NULL,
	`duplicate_risk_score` integer NOT NULL,
	`total_score` integer NOT NULL,
	`decision` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `candidate_evaluations_item_idx` ON `candidate_evaluations` (`item_id`);--> statement-breakpoint
CREATE TABLE `candidate_infos` (
	`item_id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`current_price` integer,
	`shipping_fee` integer,
	`total_price` integer,
	`auction_ends_at` text,
	`easy_buy_price` integer,
	`acceptable_price` integer,
	`max_bid_price` integer,
	`seller_name` text,
	`listing_description` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `decision_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text NOT NULL,
	`price_at_decision` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `decision_logs_item_idx` ON `decision_logs` (`item_id`);--> statement-breakpoint
CREATE TABLE `failure_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`result` text NOT NULL,
	`reason` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `failure_logs_item_idx` ON `failure_logs` (`item_id`);--> statement-breakpoint
CREATE TABLE `fit_anchors` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fit_anchors_category_idx` ON `fit_anchors` (`category`);--> statement-breakpoint
CREATE TABLE `item_tags` (
	`item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`item_id`, `tag_id`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`model_name` text,
	`category` text NOT NULL,
	`color` text,
	`size_label` text,
	`purchase_price` integer,
	`shipping_fee` integer,
	`total_price` integer,
	`purchase_date` text,
	`purchase_source` text,
	`product_url` text,
	`condition_rank` text,
	`condition_notes` text,
	`fit_rating` text,
	`favorite_score` integer,
	`is_fit_anchor` integer DEFAULT false NOT NULL,
	`is_sell_candidate` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `items_status_idx` ON `items` (`status`);--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `items` (`category`);--> statement-breakpoint
CREATE INDEX `items_brand_idx` ON `items` (`brand`);--> statement-breakpoint
CREATE TABLE `measurement_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`measurement_key` text NOT NULL,
	`operator` text NOT NULL,
	`value` integer NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `measurement_rules_cat_key_idx` ON `measurement_rules` (`category`,`measurement_key`);--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`key` text NOT NULL,
	`value` integer NOT NULL,
	`unit` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `measurements_item_idx` ON `measurements` (`item_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`relative_path` text NOT NULL,
	`thumbnail_relative_path` text,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_item_idx` ON `photos` (`item_id`);--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`price` integer NOT NULL,
	`shipping_fee` integer,
	`total_price` integer,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_snapshots_item_idx` ON `price_snapshots` (`item_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`remind_at` text NOT NULL,
	`notification_id` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_item_idx` ON `reminders` (`item_id`);--> statement-breakpoint
CREATE TABLE `sale_infos` (
	`item_id` text PRIMARY KEY NOT NULL,
	`sold_price` integer,
	`sold_at` text,
	`sold_source` text,
	`notes` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `wear_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`worn_at` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `wear_logs_item_idx` ON `wear_logs` (`item_id`);