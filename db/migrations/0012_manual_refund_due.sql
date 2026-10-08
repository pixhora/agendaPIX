ALTER TABLE "payments" ADD COLUMN "manual_refund_due_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "manual_refund_reminder_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "policy_refund_requested_on" date;
--> statement-breakpoint
CREATE TABLE "owner_notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "booking_id" uuid NOT NULL,
  "payment_id" uuid,
  "kind" text NOT NULL,
  "email_sent_at" timestamp with time zone,
  "reminder_count" integer DEFAULT 0 NOT NULL,
  "last_reminded_on" date,
  "dismissed_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "owner_notices" ADD CONSTRAINT "owner_notices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "owner_notices" ADD CONSTRAINT "owner_notices_business_booking_kind_unique" UNIQUE("business_id","booking_id","kind");
--> statement-breakpoint
ALTER TABLE "owner_notices" ADD CONSTRAINT "owner_notices_kind_not_empty" CHECK (length(trim("kind")) > 0);
--> statement-breakpoint
CREATE INDEX "owner_notices_business_kind_idx" ON "owner_notices" USING btree ("business_id","kind");
--> statement-breakpoint
CREATE TABLE "payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "booking_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "mp_refund_id" text,
  "error_code" text,
  "requested_by_user_id" text,
  "idempotency_key" text NOT NULL,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_tenant_fk" FOREIGN KEY ("business_id","payment_id") REFERENCES "public"."payments"("business_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_booking_tenant_fk" FOREIGN KEY ("business_id","booking_id") REFERENCES "public"."bookings"("business_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_idempotency_key_unique" UNIQUE("idempotency_key");
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_amount_positive" CHECK ("amount_cents" > 0);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_idempotency_key_not_empty" CHECK (length(trim("idempotency_key")) > 0);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_kind_valid" CHECK ("kind" in ('owner_api', 'auto_late', 'owner_manual_mark'));
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_status_valid" CHECK ("status" in ('requested', 'processing', 'refunded', 'rejected', 'failed'));
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_one_active_per_payment" ON "payment_refunds" USING btree ("payment_id") WHERE "status" in ('requested', 'processing', 'refunded');
--> statement-breakpoint
CREATE INDEX "payment_refunds_payment_idx" ON "payment_refunds" USING btree ("payment_id");
