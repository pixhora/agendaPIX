-- Dedupe de webhook por x-request-id. Rodar antes do deploy que passa a gravar esta tabela.
-- Limpeza operacional, retenção de 30 dias. Não executar neste arquivo:
-- DELETE FROM "webhook_events" WHERE "received_at" < now() - interval '30 days';
CREATE TABLE "webhook_events" (
	"provider" text NOT NULL,
	"request_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("provider", "request_id"),
	CONSTRAINT "webhook_events_id_not_empty" CHECK (length(trim("provider")) > 0 AND length(trim("request_id")) > 0 AND char_length("request_id") <= 128)
);--> statement-breakpoint
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events" ("received_at");
