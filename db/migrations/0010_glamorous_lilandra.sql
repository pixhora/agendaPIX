CREATE TABLE "payment_provider_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"reference" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_references_unique" UNIQUE("provider","reference"),
	CONSTRAINT "payment_provider_references_provider_not_empty" CHECK (length(trim("payment_provider_references"."provider")) > 0),
	CONSTRAINT "payment_provider_references_reference_not_empty" CHECK (length(trim("payment_provider_references"."reference")) > 0),
	CONSTRAINT "payment_provider_references_external_id_not_empty" CHECK (length(trim("payment_provider_references"."external_id")) > 0)
);
--> statement-breakpoint
CREATE INDEX "payment_provider_references_reference_idx" ON "payment_provider_references" USING btree ("reference");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_unique" UNIQUE("business_id","id");