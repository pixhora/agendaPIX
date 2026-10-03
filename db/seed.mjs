import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { databaseEnvSchema } from "../lib/env.ts";

const slug = "barbearia-demo";
const email = "dono-demo@example.com";
const demoServices = [
  { id: "c189f040-17dd-4606-b8c4-08474eb2cdb1", name: "Corte", durationMinutes: 30, priceCents: 3500, depositCents: 1000 },
  { id: "c189f040-17dd-4606-b8c4-08474eb2cdb2", name: "Barba", durationMinutes: 30, priceCents: 2500, depositCents: 500 },
  { id: "c189f040-17dd-4606-b8c4-08474eb2cdb3", name: "Corte e barba", durationMinutes: 60, priceCents: 5500, depositCents: 1500 },
];

// Dados fictícios para desenvolvimento. Nunca modifica cadastros existentes.
if (process.env.NODE_ENV === "production") throw new Error("Seed demo não pode rodar em produção.");
const env = databaseEnvSchema.parse(process.env);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`seed:${slug}`]);
  await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING', [randomUUID(), "Dono da barbearia demo", email]);
  const { rows: [owner] } = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
  await client.query("INSERT INTO businesses (owner_id, name, slug, timezone) VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO NOTHING", [owner.id, "Barbearia Demo", slug, "America/Sao_Paulo"]);
  const { rows: [business] } = await client.query("SELECT id, owner_id FROM businesses WHERE slug = $1 FOR UPDATE", [slug]);
  if (business.owner_id !== owner.id) throw new Error("O slug demo já pertence a outro dono; nenhum dado foi alterado.");
  for (const service of demoServices) {
    await client.query("INSERT INTO services (id, business_id, name, duration_minutes, price_cents, deposit_cents) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
      [service.id, business.id, service.name, service.durationMinutes, service.priceCents, service.depositCents]);
    const { rows: [existing] } = await client.query("SELECT business_id FROM services WHERE id = $1", [service.id]);
    if (existing.business_id !== business.id) throw new Error("Um identificador de serviço demo já pertence a outro negócio; nenhum dado foi alterado.");
  }
  for (let weekday = 1; weekday <= 6; weekday++) {
    await client.query("INSERT INTO business_hours (business_id, weekday, opens_at, closes_at) VALUES ($1, $2, '09:00:00', '18:00:00') ON CONFLICT (business_id, weekday) DO NOTHING", [business.id, weekday]);
  }
  await client.query("COMMIT");
  process.stdout.write(`Demo pronta: ${slug}. Login por link mágico: ${email}.\n`);
} catch (error) {
  if (client) await client.query("ROLLBACK");
  process.stderr.write(`Falha no seed demo: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
