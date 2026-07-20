-- Custom SQL migration file, put your code below! --
-- Split the legacy `shirt` category into short_sleeve_shirt / long_sleeve_shirt.
-- Sleeve length is unknown for pre-split rows, so remap to long_sleeve_shirt as a
-- best-effort default (oxford / flannel / western / knit dress shirts dominate).
-- Applied to every table that stores a garment category.
UPDATE `items` SET `category` = 'long_sleeve_shirt' WHERE `category` = 'shirt';--> statement-breakpoint
UPDATE `fit_anchors` SET `category` = 'long_sleeve_shirt' WHERE `category` = 'shirt';--> statement-breakpoint
UPDATE `measurement_rules` SET `category` = 'long_sleeve_shirt' WHERE `category` = 'shirt';--> statement-breakpoint
UPDATE `brand_guides` SET `category` = 'long_sleeve_shirt' WHERE `category` = 'shirt';