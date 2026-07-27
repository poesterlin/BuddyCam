DROP TRIGGER IF EXISTS "notify_after_insert" ON "event";--> statement-breakpoint
DROP FUNCTION IF EXISTS notify_new_notification();--> statement-breakpoint
DELETE FROM "event" WHERE "is_technical" = true OR "read" = true;--> statement-breakpoint
UPDATE "event" SET "persistent" = true WHERE "is_technical" = false;--> statement-breakpoint
DROP INDEX "event_user_id_send_at_index";--> statement-breakpoint
CREATE INDEX "event_unread_persistent_idx" ON "event" USING btree ("user_id","created_at") WHERE "event"."persistent" = true AND "event"."read" = false;--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "send_at";
