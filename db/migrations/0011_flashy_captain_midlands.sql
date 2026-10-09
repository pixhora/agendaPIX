-- Negócios já existentes ganham 7 dias a partir desta migration (now() + interval '7 days'), não da created_at.
-- Para mudar a âncora dos negócios atuais, altere o DEFAULT de trial_ends_at antes de aplicar.
-- Negócios criados depois usam o fim do 7º dia local em provisionBusiness.
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"status" "subscription_status" NOT NULL,
	"provider" text,
	"external_id" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "policy_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "policy_text" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reschedule_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "policy_hash" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "trial_ends_at" timestamp with time zone DEFAULT (now() + interval '7 days') NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "contact_whatsapp" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "deposit_policy" jsonb DEFAULT '{"version":1,"preset":"padrao","refundUntilHours":24,"rescheduleUntilHours":24,"maxReschedules":1,"lateCancel":"retain","noShow":"retain","creditValidityDays":60}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_policy_hash_format" CHECK ("bookings"."policy_hash" IS NULL OR "bookings"."policy_hash" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_policy_snapshot_pair" CHECK (("bookings"."policy_snapshot" IS NULL) = ("bookings"."policy_text" IS NULL) AND ("bookings"."policy_snapshot" IS NULL) = ("bookings"."policy_hash" IS NULL));--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_contact_whatsapp_format" CHECK ("businesses"."contact_whatsapp" IS NULL OR "businesses"."contact_whatsapp" ~ '^[+][1-9][0-9]{7,14}$');--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_deposit_policy_object" CHECK (jsonb_typeof("services"."deposit_policy") = 'object');