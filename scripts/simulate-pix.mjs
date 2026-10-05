#!/usr/bin/env node
/**
 * Confirma o último pagamento Pix fake pendente de um negócio via webhook assinado.
 * Uso: pnpm pix:simulate [slug]
 * Requer NODE_ENV≠production, PAYMENT_PROVIDER=fake e FAKE_WEBHOOK_SECRET válidos.
 */
import { createHmac } from "node:crypto";
import pg from "pg";

const slug = process.argv[2] ?? "barbearia-demo";
const baseUrl = (process.env.PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const secret = process.env.FAKE_WEBHOOK_SECRET;
const databaseUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV === "production") {
  console.error("pix:simulate bloqueado em production.");
  process.exit(1);
}
if (process.env.PAYMENT_PROVIDER !== "fake") {
  console.error("pix:simulate exige PAYMENT_PROVIDER=fake.");
  process.exit(1);
}
if (!secret || secret.length < 32 || secret.startsWith("replace-this-")) {
  console.error("FAKE_WEBHOOK_SECRET inválido ou ausente.");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("DATABASE_URL ausente.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
try {
  const { rows } = await pool.query(
    `select p.external_id, p.amount_cents
       from payments p
       join businesses b on b.id = p.business_id
      where b.slug = $1 and p.status in ('pending', 'creating')
      order by p.created_at desc
      limit 1`,
    [slug],
  );
  const row = rows[0];
  if (!row?.external_id) {
    console.error(`Nenhum pagamento pendente para slug=${slug}`);
    process.exit(1);
  }

  const body = JSON.stringify({
    eventId: `evt-cli-${Date.now()}`,
    type: "payment.paid",
    externalId: row.external_id,
    amountCents: Number(row.amount_cents),
    paidAt: new Date().toISOString(),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  console.log(`Confirmando ${row.external_id} (${row.amount_cents} centavos) em ${baseUrl} ...`);
  const res = await fetch(`${baseUrl}/api/webhooks/payments/fake`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fake-timestamp": timestamp,
      "x-fake-signature": signature,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Webhook falhou (${res.status}): ${text}`);
    process.exit(1);
  }
  console.log(text || `OK ${res.status}`);
} finally {
  await pool.end();
}
