CREATE TABLE "provider_charge_references" (
	"provider" text NOT NULL,
	"reference" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_charge_references_pk" PRIMARY KEY("provider","reference"),
	CONSTRAINT "provider_charge_references_external_unique" UNIQUE("provider","external_id"),
	CONSTRAINT "provider_charge_references_not_empty" CHECK (length(trim("provider_charge_references"."reference")) > 0 AND length(trim("provider_charge_references"."external_id")) > 0)
);
