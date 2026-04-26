PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_measurement_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`measurement_key` text NOT NULL,
	`operator` text NOT NULL,
	`value` real NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_measurement_rules`("id", "category", "measurement_key", "operator", "value", "severity", "message", "created_at", "updated_at") SELECT "id", "category", "measurement_key", "operator", "value", "severity", "message", "created_at", "updated_at" FROM `measurement_rules`;--> statement-breakpoint
DROP TABLE `measurement_rules`;--> statement-breakpoint
ALTER TABLE `__new_measurement_rules` RENAME TO `measurement_rules`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `measurement_rules_cat_key_idx` ON `measurement_rules` (`category`,`measurement_key`);--> statement-breakpoint
CREATE TABLE `__new_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`key` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_measurements`("id", "item_id", "key", "value", "unit") SELECT "id", "item_id", "key", "value", "unit" FROM `measurements`;--> statement-breakpoint
DROP TABLE `measurements`;--> statement-breakpoint
ALTER TABLE `__new_measurements` RENAME TO `measurements`;--> statement-breakpoint
CREATE INDEX `measurements_item_idx` ON `measurements` (`item_id`);