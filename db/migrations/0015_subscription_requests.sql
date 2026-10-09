-- Na branch de integração: 0015_subscription_requests.
-- O #33 tem duas migrations (0013 e 0014), então esta não é 0014.
CREATE TABLE "subscription_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by" text,
	CONSTRAINT "subscription_requests_provider_valid" CHECK ("subscription_requests"."provider" IN ('manual', 'pix_platform')),
	CONSTRAINT "subscription_requests_handled_pair" CHECK (("subscription_requests"."handled_at" IS NULL) = ("subscription_requests"."handled_by" IS NULL)),
	CONSTRAINT "subscription_requests_handled_by_not_blank" CHECK ("subscription_requests"."handled_by" IS NULL OR length(trim("subscription_requests"."handled_by")) > 0)
);
--> statement-breakpoint
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_requests_one_open_per_business_idx" ON "subscription_requests" USING btree ("business_id") WHERE "subscription_requests"."handled_at" IS NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_provider_valid" CHECK ("subscriptions"."provider" IS NULL OR "subscriptions"."provider" IN ('manual', 'pix_platform'));