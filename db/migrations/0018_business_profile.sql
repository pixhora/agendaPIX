ALTER TABLE "businesses" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_logo_url_https" CHECK ("logo_url" IS NULL OR "logo_url" ~ '^https://[^[:space:]]+/[^[:space:]]+$');--> statement-breakpoint
CREATE TABLE "business_slug_history" (
	"old_slug" text PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	CONSTRAINT "business_slug_history_slug_format" CHECK ("old_slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);--> statement-breakpoint
ALTER TABLE "business_slug_history" ADD CONSTRAINT "business_slug_history_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_slug_history_business_idx" ON "business_slug_history" USING btree ("business_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reject_business_slug_overlap"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_TABLE_NAME = 'businesses' THEN
		IF EXISTS (
			SELECT 1 FROM "business_slug_history"
			WHERE "old_slug" = NEW."slug"
				AND ("released_at" IS NULL OR "released_at" > now() - interval '90 days')
		) THEN
			RAISE EXCEPTION 'slug_taken' USING ERRCODE = '23505';
		END IF;
	ELSIF EXISTS (SELECT 1 FROM "businesses" WHERE "slug" = NEW."old_slug") THEN
		RAISE EXCEPTION 'slug_taken' USING ERRCODE = '23505';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "businesses_slug_not_alias" BEFORE INSERT OR UPDATE OF "slug" ON "businesses" FOR EACH ROW EXECUTE FUNCTION "reject_business_slug_overlap"();--> statement-breakpoint
CREATE TRIGGER "business_slug_history_not_current" BEFORE INSERT OR UPDATE OF "old_slug" ON "business_slug_history" FOR EACH ROW EXECUTE FUNCTION "reject_business_slug_overlap"();