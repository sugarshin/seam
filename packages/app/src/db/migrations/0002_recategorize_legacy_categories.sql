-- Custom SQL migration file, put your code below! --
-- Recategorize legacy coarse categories into the finer-grained taxonomy.
--   pants  -> denim_pants  (best-effort default; jeans are the most common bottoms)
--   jacket -> other_jacket (closest generic jacket bucket)
--   shoes  -> sneakers
-- Applied to every table that stores a garment category.
UPDATE `items` SET `category` = 'denim_pants' WHERE `category` = 'pants';--> statement-breakpoint
UPDATE `items` SET `category` = 'other_jacket' WHERE `category` = 'jacket';--> statement-breakpoint
UPDATE `items` SET `category` = 'sneakers' WHERE `category` = 'shoes';--> statement-breakpoint
UPDATE `fit_anchors` SET `category` = 'denim_pants' WHERE `category` = 'pants';--> statement-breakpoint
UPDATE `fit_anchors` SET `category` = 'other_jacket' WHERE `category` = 'jacket';--> statement-breakpoint
UPDATE `fit_anchors` SET `category` = 'sneakers' WHERE `category` = 'shoes';--> statement-breakpoint
UPDATE `measurement_rules` SET `category` = 'denim_pants' WHERE `category` = 'pants';--> statement-breakpoint
UPDATE `measurement_rules` SET `category` = 'other_jacket' WHERE `category` = 'jacket';--> statement-breakpoint
UPDATE `measurement_rules` SET `category` = 'sneakers' WHERE `category` = 'shoes';--> statement-breakpoint
UPDATE `brand_guides` SET `category` = 'denim_pants' WHERE `category` = 'pants';--> statement-breakpoint
UPDATE `brand_guides` SET `category` = 'other_jacket' WHERE `category` = 'jacket';--> statement-breakpoint
UPDATE `brand_guides` SET `category` = 'sneakers' WHERE `category` = 'shoes';