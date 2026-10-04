CREATE TABLE "booking_rate_limits" (
	"business_id" uuid NOT NULL,
	"client_hash" text NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer NOT NULL,
	CONSTRAINT "booking_rate_limits_business_id_client_hash_pk" PRIMARY KEY("business_id","client_hash"),
	CONSTRAINT "booking_rate_attempts_valid" CHECK ("booking_rate_limits"."attempts" BETWEEN 1 AND 10)
);
--> statement-breakpoint
ALTER TABLE "booking_rate_limits" ADD CONSTRAINT "booking_rate_limits_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_rate_window_idx" ON "booking_rate_limits" USING btree ("window_started_at");