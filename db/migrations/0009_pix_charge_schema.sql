ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_unique" UNIQUE("business_id","id");--> statement-breakpoint
CREATE TABLE "payment_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_audit_action_not_empty" CHECK (length(trim("payment_audit"."action")) > 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'creating';--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "late_payment_policy" text DEFAULT 'refund' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_audit" ADD CONSTRAINT "payment_audit_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_audit" ADD CONSTRAINT "payment_audit_payment_tenant_fk" FOREIGN KEY ("business_id","payment_id") REFERENCES "public"."payments"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_audit" ADD CONSTRAINT "payment_audit_booking_tenant_fk" FOREIGN KEY ("business_id","booking_id") REFERENCES "public"."bookings"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_audit_business_created_idx" ON "payment_audit" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_audit_payment_idx" ON "payment_audit" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_reconcile_status_idx" ON "payments" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_late_payment_policy_valid" CHECK ("businesses"."late_payment_policy" IN ('refund', 'rebook_if_free'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_creating_has_no_qr" CHECK ("payments"."status" <> 'creating' OR ("payments"."qr_code_data_url" IS NULL AND "payments"."copy_paste" IS NULL AND "payments"."external_id" IS NULL));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_pending_has_qr" CHECK ("payments"."status" <> 'pending' OR ("payments"."external_id" IS NOT NULL AND "payments"."qr_code_data_url" IS NOT NULL AND "payments"."copy_paste" IS NOT NULL));
