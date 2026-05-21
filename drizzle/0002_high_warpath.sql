ALTER TABLE "telegram_messages" ALTER COLUMN "application_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "status" text DEFAULT 'submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_messages" ADD COLUMN "candidate_id" text;--> statement-breakpoint
UPDATE telegram_messages tm
SET candidate_id = a.candidate_id
FROM applications a
WHERE tm.application_id = a.id AND tm.candidate_id IS NULL;--> statement-breakpoint
ALTER TABLE "telegram_messages" ALTER COLUMN "candidate_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
