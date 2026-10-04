// Fixture operacional local, nunca um mecanismo de login do produto.
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { openSync, writeFileSync, closeSync, unlinkSync } from "node:fs";
import { getCookies } from "better-auth/cookies";
import { makeSignature } from "better-auth/crypto";
import pg from "pg";
import { z } from "zod";

const output = process.argv[2];
if (!output || process.env.NODE_ENV !== "development") {
  throw new Error("Use NODE_ENV=development node scripts/create_backend_fixture.mjs /caminho/privado/fixture.json");
}
const env = z.object({ DATABASE_URL: z.url(), BETTER_AUTH_URL: z.url(), BETTER_AUTH_SECRET: z.string().min(32), PIX_KEY_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/) }).parse(process.env);
const databaseUrl = new URL(env.DATABASE_URL);
const authUrl = new URL(env.BETTER_AUTH_URL);
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol) || !["localhost", "127.0.0.1"].includes(databaseUrl.hostname)
  || authUrl.origin !== "http://localhost:3000" || env.BETTER_AUTH_SECRET.startsWith("replace-this-")) {
  throw new Error("Fixture exige banco local e autoridade http://localhost:3000.");
}
const fd = openSync(output, "wx", 0o600);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client;
let complete = false;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  const userId = randomUUID();
  const businessId = randomUUID();
  const serviceId = randomUUID();
  const slug = `b02-fixture-${businessId}`;
  const email = `b02-${userId}@example.com`;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 3600000);
  await client.query('INSERT INTO "user" (id, name, email, email_verified) VALUES ($1,$2,$3,true)', [userId, "Dono sintético B02", email]);
  await client.query("INSERT INTO businesses(id,owner_id,name,slug) VALUES($1,$2,$3,$4)", [businessId, userId, "Negócio sintético B02", slug]);
  await client.query("INSERT INTO services(id,business_id,name,duration_minutes,price_cents,deposit_cents) VALUES($1,$2,$3,30,3500,1000)", [serviceId, businessId, "Serviço sintético B02"]);
  for (let weekday = 1; weekday <= 6; weekday++) await client.query("INSERT INTO business_hours(business_id,weekday,opens_at,closes_at) VALUES($1,$2,'09:00','18:00')", [businessId, weekday]);
  await client.query('INSERT INTO "session" (id,user_id,token,expires_at) VALUES($1,$2,$3,$4)', [randomUUID(), userId, token, expiresAt]);
  const cookieName = getCookies({ baseURL: env.BETTER_AUTH_URL }).sessionToken.name;
  const cookie = `${cookieName}=${encodeURIComponent(`${token}.${await makeSignature(token, env.BETTER_AUTH_SECRET)}`)}`;
  await client.query("COMMIT");
  writeFileSync(fd, JSON.stringify({ authority: authUrl.origin, dashboard: "http://localhost:3343", userId, businessId, serviceId, slug, email, expiresAt, cookie }, null, 2));
  complete = true;
  process.stdout.write("Fixture local criada; sessão e identificadores somente no arquivo privado indicado.\n");
} finally {
  if (!complete) {
    if (client) await client.query("ROLLBACK");
    unlinkSync(output);
  }
  closeSync(fd);
  client?.release();
  await pool.end();
}
