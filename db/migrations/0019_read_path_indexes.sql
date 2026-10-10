CREATE INDEX IF NOT EXISTS "payments_booking_created_idx" ON "payments" ("business_id", "booking_id", "created_at" DESC);
