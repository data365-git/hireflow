ALTER TABLE "telegram_messages" ADD COLUMN "attachment_file_id" text;--> statement-breakpoint
ALTER TABLE "telegram_messages" ADD COLUMN "attachment_type" text;--> statement-breakpoint
ALTER TABLE "telegram_messages" ADD COLUMN "attachment_filename" text;