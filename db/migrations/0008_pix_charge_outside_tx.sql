-- Valores novos do enum precisam ser commitados antes de uso (DEFAULT/CHECK).
-- Esta migration contém somente ADD VALUE e deve permanecer assim.
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'creating' BEFORE 'pending';
--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'cancelled' BEFORE 'failed';
--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'refund_pending';
