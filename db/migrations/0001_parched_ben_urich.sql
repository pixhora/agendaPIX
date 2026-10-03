CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"external_id" text NOT NULL,
	"payload_hash" text NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_provider_event_unique" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text,
	"body_hash" text,
	"outcome" text DEFAULT 'received' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "request_key" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "access_token_hash" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "qr_code_data_url" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "copy_paste" text;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_event_idx" ON "webhook_deliveries" USING btree ("provider","event_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_request_unique" UNIQUE("business_id","request_key");