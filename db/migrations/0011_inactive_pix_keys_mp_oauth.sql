CREATE TABLE "mercadopago_connections" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"mp_user_id" text NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"public_key" text,
	"scope" text,
	"live_mode" boolean,
	"expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone NOT NULL,
	"refreshed_at" timestamp with time zone,
	"status" text NOT NULL,
	"last_error" text,
	"disconnected_at" timestamp with time zone,
	"consent_version" text,
	"auto_refund_ack_at" timestamp with time zone,
	"consent_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mercadopago_connections_status_valid" CHECK ("mercadopago_connections"."status" IN ('connected', 'needs_reconnect', 'disconnected')),
	CONSTRAINT "mercadopago_connections_mp_user_not_empty" CHECK (length(trim("mercadopago_connections"."mp_user_id")) > 0),
	CONSTRAINT "mercadopago_connections_tokens_match_status" CHECK ((
    ("mercadopago_connections"."status" = 'connected' AND "mercadopago_connections"."disconnected_at" IS NULL AND "mercadopago_connections"."access_token_enc" IS NOT NULL AND "mercadopago_connections"."refresh_token_enc" IS NOT NULL AND length("mercadopago_connections"."access_token_enc") > 0 AND length("mercadopago_connections"."refresh_token_enc") > 0 AND "mercadopago_connections"."expires_at" IS NOT NULL)
    OR ("mercadopago_connections"."status" = 'needs_reconnect' AND "mercadopago_connections"."access_token_enc" IS NULL AND "mercadopago_connections"."refresh_token_enc" IS NULL)
    OR ("mercadopago_connections"."status" = 'disconnected' AND "mercadopago_connections"."disconnected_at" IS NOT NULL AND (
      ("mercadopago_connections"."access_token_enc" IS NULL AND "mercadopago_connections"."refresh_token_enc" IS NULL)
      OR ("mercadopago_connections"."access_token_enc" IS NOT NULL AND "mercadopago_connections"."refresh_token_enc" IS NOT NULL AND length("mercadopago_connections"."access_token_enc") > 0 AND length("mercadopago_connections"."refresh_token_enc") > 0)
    ))
  ))
);
--> statement-breakpoint
CREATE TABLE "mercadopago_oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"return_to" text NOT NULL,
	"consent_version" text NOT NULL,
	"auto_refund_ack_at" timestamp with time zone NOT NULL,
	"consent_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mercadopago_oauth_states_not_empty" CHECK (length(trim("mercadopago_oauth_states"."state")) > 0 AND length(trim("mercadopago_oauth_states"."consent_version")) > 0 AND length(trim("mercadopago_oauth_states"."consent_user_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "mp_connection_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mp_connection_events_kind_not_empty" CHECK (length(trim("mp_connection_events"."kind")) > 0)
);
--> statement-breakpoint
CREATE TABLE "owner_notices" (
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_notices_business_id_kind_pk" PRIMARY KEY("business_id","kind"),
	CONSTRAINT "owner_notices_kind_not_empty" CHECK (length(trim("owner_notices"."kind")) > 0)
);
--> statement-breakpoint
ALTER TABLE "business_pix_keys" ADD COLUMN "deactivated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "business_pix_keys" ADD COLUMN "deactivation_reason" text DEFAULT 'pix_key_retired' NOT NULL;--> statement-breakpoint
ALTER TABLE "mercadopago_connections" ADD CONSTRAINT "mercadopago_connections_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mercadopago_oauth_states" ADD CONSTRAINT "mercadopago_oauth_states_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_connection_events" ADD CONSTRAINT "mp_connection_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_notices" ADD CONSTRAINT "owner_notices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mercadopago_connections_mp_user_connected_uq" ON "mercadopago_connections" USING btree ("mp_user_id") WHERE "mercadopago_connections"."status" = 'connected';--> statement-breakpoint
CREATE INDEX "mercadopago_connections_refresh_idx" ON "mercadopago_connections" USING btree ("expires_at") WHERE "mercadopago_connections"."status" = 'connected';--> statement-breakpoint
CREATE INDEX "mercadopago_oauth_states_business_idx" ON "mercadopago_oauth_states" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "mp_connection_events_business_idx" ON "mp_connection_events" USING btree ("business_id","created_at");--> statement-breakpoint
ALTER TABLE "business_pix_keys" ADD CONSTRAINT "business_pix_keys_retired" CHECK ("business_pix_keys"."deactivated_at" IS NOT NULL AND length(trim("business_pix_keys"."deactivation_reason")) > 0);