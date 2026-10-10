-- Rodar antes do deploy. Sem esta tabela o link de horário responde 500.
CREATE TYPE "public"."slot_link_status" AS ENUM('pending', 'paid', 'expired', 'taken', 'cancelled');--> statement-breakpoint
CREATE TABLE "slot_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "slot_link_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"preview_id" text NOT NULL,
	"booking_id" uuid,
	"pay_started_at" timestamp with time zone,
	"pay_idempotency_hash" text,
	"customer_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_links_business_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "slot_links_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "slot_links_preview_id_unique" UNIQUE("preview_id"),
	CONSTRAINT "slot_links_interval_valid" CHECK ("slot_links"."starts_at" < "slot_links"."ends_at"),
	CONSTRAINT "slot_links_expires_before_start" CHECK ("slot_links"."expires_at" <= "slot_links"."starts_at"),
	CONSTRAINT "slot_links_expires_after_create" CHECK ("slot_links"."expires_at" > "slot_links"."created_at"),
	CONSTRAINT "slot_links_token_hash_format" CHECK ("slot_links"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "slot_links_preview_id_format" CHECK ("slot_links"."preview_id" ~ '^[A-Za-z0-9_-]{22}$'),
	CONSTRAINT "slot_links_customer_label_length" CHECK ("slot_links"."customer_label" IS NULL OR (length(trim("slot_links"."customer_label")) > 0 AND char_length("slot_links"."customer_label") <= 80)),
	CONSTRAINT "slot_links_paid_has_booking" CHECK ("slot_links"."status" <> 'paid' OR "slot_links"."booking_id" IS NOT NULL),
	CONSTRAINT "slot_links_pay_claim_pair" CHECK (("slot_links"."pay_started_at" IS NULL) = ("slot_links"."pay_idempotency_hash" IS NULL)),
	CONSTRAINT "slot_links_pay_idempotency_hash_format" CHECK ("slot_links"."pay_idempotency_hash" IS NULL OR "slot_links"."pay_idempotency_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "slot_links" ADD CONSTRAINT "slot_links_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_links" ADD CONSTRAINT "slot_links_service_tenant_fk" FOREIGN KEY ("business_id","service_id") REFERENCES "public"."services"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_links" ADD CONSTRAINT "slot_links_booking_tenant_fk" FOREIGN KEY ("business_id","booking_id") REFERENCES "public"."bookings"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slot_links_booking_id_unique" ON "slot_links" USING btree ("booking_id") WHERE "slot_links"."booking_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "slot_links_business_start_idx" ON "slot_links" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "slot_links_business_created_idx" ON "slot_links" USING btree ("business_id","created_at");