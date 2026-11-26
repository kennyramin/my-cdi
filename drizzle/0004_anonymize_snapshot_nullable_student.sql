-- Orphan visits (student_id without a student) get NULL student_id and snapshot so the FK check cannot abort startup.
-- No PRAGMA foreign_keys here: it is a no-op inside the migration transaction, and dropping the child table frequentation cascades nothing.
CREATE TABLE `__new_frequentation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`starts_at` text NOT NULL,
	`activity` text NOT NULL,
	`student_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`student_classe` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_frequentation`("id", "starts_at", "activity", "student_id", "created_at", "updated_at", "student_classe") SELECT f.`id`, f.`starts_at`, f.`activity`, (SELECT s2.`id` FROM `students` s2 WHERE s2.`id` = f.`student_id`), f.`created_at`, f.`updated_at`, (SELECT s.`classe` FROM `students` s WHERE s.`id` = f.`student_id`) FROM `frequentation` f;--> statement-breakpoint
CREATE TABLE `__frequentation_seq` AS SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'frequentation';--> statement-breakpoint
DROP TABLE `frequentation`;--> statement-breakpoint
ALTER TABLE `__new_frequentation` RENAME TO `frequentation`;--> statement-breakpoint
DELETE FROM `sqlite_sequence` WHERE `name` = 'frequentation';--> statement-breakpoint
INSERT INTO `sqlite_sequence`(`name`, `seq`) SELECT 'frequentation', `seq` FROM `__frequentation_seq`;--> statement-breakpoint
DROP TABLE `__frequentation_seq`;--> statement-breakpoint
CREATE INDEX `idx_freq_student` ON `frequentation` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_freq_starts_at` ON `frequentation` (`starts_at`);
