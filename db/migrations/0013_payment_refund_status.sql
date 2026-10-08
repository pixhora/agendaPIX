ALTER TABLE "payments" ADD COLUMN "refund_status" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_status_valid" CHECK ("refund_status" IS NULL OR "refund_status" IN ('in_process', 'refunded', 'failed'));
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_timestamp_required" CHECK ("refund_status" IS DISTINCT FROM 'refunded' OR "refunded_at" IS NOT NULL);
