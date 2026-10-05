CREATE TABLE "webhook_deliveries_legacy" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text,
	"body_hash" text,
	"outcome" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_rate_limits" DROP CONSTRAINT "booking_rate_attempts_valid";--> statement-breakpoint
-- Preserva para auditoria as entregas antigas não verificadas (sem event_id/body_hash) e as duplicadas por evento,
-- mantendo em webhook_deliveries uma linha por (provider, event_id), preferindo o resultado de processamento (não duplicate/failed) mais recente.
INSERT INTO "webhook_deliveries_legacy" ("id", "provider", "event_id", "body_hash", "outcome", "reason", "created_at")
SELECT "id", "provider", "event_id", "body_hash", "outcome", "reason", "created_at" FROM "webhook_deliveries"
WHERE "event_id" IS NULL OR "body_hash" IS NULL OR "id" NOT IN (
  SELECT DISTINCT ON ("provider", "event_id") "id" FROM "webhook_deliveries"
  WHERE "event_id" IS NOT NULL AND "body_hash" IS NOT NULL
  ORDER BY "provider", "event_id", CASE WHEN "outcome" IN ('received', 'failed') THEN 2 WHEN "outcome" = 'duplicate' THEN 1 ELSE 0 END, "created_at" DESC
);--> statement-breakpoint
DELETE FROM "webhook_deliveries" WHERE "id" IN (SELECT "id" FROM "webhook_deliveries_legacy");--> statement-breakpoint
DROP INDEX "webhook_deliveries_event_idx";--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "event_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "body_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "client_hash" text;--> statement-breakpoint
CREATE INDEX "bookings_pending_hold_idx" ON "bookings" USING btree ("business_id","expires_at") WHERE "bookings"."status" = 'pending_payment';--> statement-breakpoint
CREATE INDEX "bookings_pending_client_idx" ON "bookings" USING btree ("business_id","client_hash") WHERE "bookings"."status" = 'pending_payment';--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_provider_event_unique" UNIQUE("provider","event_id");--> statement-breakpoint
ALTER TABLE "booking_rate_limits" ADD CONSTRAINT "booking_rate_attempts_valid" CHECK ("booking_rate_limits"."attempts" >= 1);