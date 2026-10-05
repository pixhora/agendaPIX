CREATE TABLE "business_pix_keys" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" text NOT NULL,
	"key_version" integer NOT NULL,
	"hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_pix_keys_cipher_valid" CHECK (length("business_pix_keys"."ciphertext") > 0 AND length("business_pix_keys"."nonce") > 0 AND "business_pix_keys"."key_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "business_pix_keys" ADD CONSTRAINT "business_pix_keys_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;