CREATE TABLE "onboarding_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"segment" text,
	"plan" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"business_id" uuid,
	CONSTRAINT "onboarding_drafts_email_not_empty" CHECK (length(trim("email")) > 0),
	CONSTRAINT "onboarding_drafts_expires_after_create" CHECK ("expires_at" > "created_at")
);
--> statement-breakpoint
ALTER TABLE "onboarding_drafts" ADD CONSTRAINT "onboarding_drafts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "onboarding_drafts_email_idx" ON "onboarding_drafts" ("email");
--> statement-breakpoint
CREATE INDEX "onboarding_drafts_expires_idx" ON "onboarding_drafts" ("expires_at");
--> statement-breakpoint
CREATE TABLE "abuse_rate_limits" (
	"scope" text NOT NULL,
	"client_hash" text NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer NOT NULL,
	CONSTRAINT "abuse_rate_limits_pk" PRIMARY KEY("scope","client_hash"),
	CONSTRAINT "abuse_rate_attempts_valid" CHECK ("attempts" >= 1),
	CONSTRAINT "abuse_rate_scope_not_empty" CHECK (length(trim("scope")) > 0 AND length(trim("client_hash")) > 0)
);
