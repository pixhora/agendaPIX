ALTER TABLE "bookings" ADD COLUMN "deposit_reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_reversal_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_reversal_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "bookings_deposit_reversal_unseen_idx" ON "bookings" USING btree ("business_id") WHERE "bookings"."deposit_reversal_reason" IS NOT NULL AND "bookings"."deposit_reversal_seen_at" IS NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deposit_reversal_reason_valid" CHECK ("bookings"."deposit_reversal_reason" IS NULL OR "bookings"."deposit_reversal_reason" IN ('refunded', 'charged_back'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deposit_reversal_pair" CHECK (("bookings"."deposit_reversal_reason" IS NULL) = ("bookings"."deposit_reversed_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deposit_reversal_seen_after_reversal" CHECK ("bookings"."deposit_reversal_seen_at" IS NULL OR "bookings"."deposit_reversed_at" IS NOT NULL);