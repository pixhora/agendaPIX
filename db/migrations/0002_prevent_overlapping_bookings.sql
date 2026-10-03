CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (business_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
WHERE (status IN ('pending_payment', 'confirmed', 'completed'));
