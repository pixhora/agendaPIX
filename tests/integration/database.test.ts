import { randomUUID } from "node:crypto";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { databaseEnvSchema } from "../../lib/env";
import { maskEmail } from "../../lib/privacy/mask-email";
import { dismissLegacyPixKeyNotice, hasUndismissedLegacyPixKey } from "../../lib/pix-key/notice";
import { findOwnedBusiness } from "../../lib/tenancy";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, connectionTimeoutMillis: 5000 });
let client: PoolClient;
let database: NodePgDatabase<typeof schema>;
let ownerA: string;
let ownerB: string;
let businessA: string;
let businessB: string;
let serviceA: string;
let serviceB: string;
let customerA: string;
let customerB: string;
let bookingA: string;

beforeEach(async () => {
  client = await pool.connect();
  await client.query("BEGIN");
  database = drizzle(client, { schema });
  ownerA = randomUUID(); ownerB = randomUUID();
  businessA = randomUUID(); businessB = randomUUID();
  serviceA = randomUUID(); serviceB = randomUUID();
  customerA = randomUUID(); customerB = randomUUID();
  bookingA = randomUUID();
  await database.insert(schema.user).values([
    { id: ownerA, name: "Dono A", email: `${ownerA}@example.com` },
    { id: ownerB, name: "Dono B", email: `${ownerB}@example.com` },
  ]);
  await database.insert(schema.businesses).values([
    { id: businessA, ownerId: ownerA, name: "Negócio A", slug: `a-${businessA}` },
    { id: businessB, ownerId: ownerB, name: "Negócio B", slug: `b-${businessB}` },
  ]);
  await database.insert(schema.services).values([
    { id: serviceA, businessId: businessA, name: "Corte A", durationMinutes: 30, priceCents: 5000, depositCents: 1000 },
    { id: serviceB, businessId: businessB, name: "Corte B", durationMinutes: 30, priceCents: 5000, depositCents: 1000 },
  ]);
  await database.insert(schema.customers).values([
    { id: customerA, businessId: businessA, name: "Cliente A", phone: "+5511999999991" },
    { id: customerB, businessId: businessB, name: "Cliente B", phone: "+5511999999992" },
  ]);
  await database.insert(schema.bookings).values({
    id: bookingA, businessId: businessA, serviceId: serviceA, customerId: customerA,
    startsAt: new Date("2030-01-01T12:00:00Z"), endsAt: new Date("2030-01-01T12:30:00Z"),
    priceCents: 5000, depositCents: 1000, status: "confirmed",
  });
});

afterEach(async () => {
  if (client) {
    await client.query("ROLLBACK");
    client.release();
  }
});
afterAll(async () => { await pool.end(); });

describe("isolamento entre negócios", () => {
  it("dono lê somente o próprio negócio", async () => {
    expect((await findOwnedBusiness(businessA, ownerA, database))?.id).toBe(businessA);
    expect(await findOwnedBusiness(businessB, ownerA, database)).toBeNull();
    expect(await findOwnedBusiness(businessA, ownerB, database)).toBeNull();
    expect(await findOwnedBusiness(randomUUID(), ownerA, database)).toBeNull();
  });
  it("inativa a chave Pix antiga sem apagar o ciphertext e só expõe um booleano", async () => {
    await client.query(
      "INSERT INTO business_pix_keys (business_id, type, ciphertext, nonce, key_version, hint) VALUES ($1, 'email', 'cipher-text-not-a-key', 'nonce-value', 1, 'd••••@example.com')",
      [businessA],
    );
    const stored = await client.query("SELECT ciphertext, hint, deactivated_at, deactivation_reason FROM business_pix_keys WHERE business_id = $1", [businessA]);
    expect(stored.rows[0].ciphertext).toBe("cipher-text-not-a-key");
    expect(stored.rows[0].hint).toBe("d••••@example.com");
    expect(stored.rows[0].deactivated_at).toBeTruthy();
    expect(stored.rows[0].deactivation_reason).toBe("pix_key_retired");
    expect(await hasUndismissedLegacyPixKey(businessA, database)).toBe(true);
    expect(await hasUndismissedLegacyPixKey(businessB, database)).toBe(false);
    const first = await client.query("SELECT dismissed_at FROM owner_notices WHERE business_id = $1 AND kind = 'pix_key_retired'", [businessA]);
    expect(first.rows).toEqual([]);
    await dismissLegacyPixKeyNotice(businessA, database);
    const dismissed = await client.query("SELECT dismissed_at, booking_id FROM owner_notices WHERE business_id = $1 AND kind = 'pix_key_retired'", [businessA]);
    await dismissLegacyPixKeyNotice(businessA, database);
    const again = await client.query("SELECT dismissed_at, booking_id FROM owner_notices WHERE business_id = $1 AND kind = 'pix_key_retired'", [businessA]);
    expect(again.rows).toHaveLength(1);
    expect(again.rows[0].dismissed_at).toEqual(dismissed.rows[0].dismissed_at);
    expect(await hasUndismissedLegacyPixKey(businessA, database)).toBe(false);
    expect(await client.query("SELECT ciphertext FROM business_pix_keys WHERE business_id = $1", [businessA])).toMatchObject({ rows: [{ ciphertext: "cipher-text-not-a-key" }] });
    expect(again.rows[0].booking_id).toBeNull();
  });
  it("aceita um aviso por reserva e recusa o segundo do mesmo par", async () => {
    const columns = await client.query(
      "SELECT table_name, is_nullable FROM information_schema.columns WHERE column_name = 'consent_text_sha256' AND table_schema = 'public' ORDER BY table_name",
    );
    expect(columns.rows).toEqual([
      { table_name: "mercadopago_connections", is_nullable: "YES" },
      { table_name: "mercadopago_oauth_states", is_nullable: "NO" },
    ]);
    await dismissLegacyPixKeyNotice(businessA, database);
    await client.query("SAVEPOINT pix_notice_dup");
    await expect(client.query(
      "INSERT INTO owner_notices (business_id, kind) VALUES ($1, 'pix_key_retired')",
      [businessA],
    )).rejects.toMatchObject({ code: "23505" });
    await client.query("ROLLBACK TO SAVEPOINT pix_notice_dup");
    const bookingB = randomUUID();
    await database.insert(schema.bookings).values({
      id: bookingB, businessId: businessA, serviceId: serviceA, customerId: customerA,
      startsAt: new Date("2030-01-02T12:00:00Z"), endsAt: new Date("2030-01-02T12:30:00Z"),
      priceCents: 5000, depositCents: 1000, status: "confirmed",
    });
    await client.query(
      "INSERT INTO owner_notices (business_id, kind, booking_id) VALUES ($1, 'refund_deadline_eve', $2), ($1, 'refund_deadline_eve', $3)",
      [businessA, bookingA, bookingB],
    );
    await client.query("SAVEPOINT booking_notice_dup");
    await expect(client.query(
      "INSERT INTO owner_notices (business_id, kind, booking_id) VALUES ($1, 'refund_deadline_eve', $2)",
      [businessA, bookingA],
    )).rejects.toMatchObject({ code: "23505" });
    await client.query("ROLLBACK TO SAVEPOINT booking_notice_dup");
    const indexes = await client.query("SELECT indexdef FROM pg_indexes WHERE tablename = 'owner_notices' ORDER BY indexname");
    const defs = indexes.rows.map((row: { indexdef: string }) => row.indexdef).join("\n");
    expect(defs).toMatch(/UNIQUE INDEX owner_notices_business_kind_uq .* WHERE \(booking_id IS NULL\)/);
    expect(defs).toMatch(/UNIQUE INDEX owner_notices_booking_kind_uq .* WHERE \(booking_id IS NOT NULL\)/);
    expect(defs).not.toMatch(/PRIMARY KEY/);
  });
  it("recusa o e-mail completo da conta Mercado Pago e aceita a máscara", async () => {
    const columns = await client.query(
      "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mercadopago_connections' AND column_name IN ('account_display_name', 'account_email_masked') ORDER BY column_name",
    );
    expect(columns.rows).toEqual([
      { column_name: "account_display_name", is_nullable: "YES" },
      { column_name: "account_email_masked", is_nullable: "YES" },
    ]);
    await client.query("SAVEPOINT raw_email");
    await expect(client.query(
      "INSERT INTO mercadopago_connections (business_id, mp_user_id, connected_at, status, account_email_masked) VALUES ($1, '99887766', now(), 'needs_reconnect', 'ana.souza@gmail.com')",
      [businessA],
    )).rejects.toMatchObject({ code: "23514" });
    await client.query("ROLLBACK TO SAVEPOINT raw_email");
    const masked = maskEmail("ana.souza@gmail.com");
    expect(maskEmail("ab@x.com")).toBe("a\u2022\u2022@x.com");
    await client.query(
      "INSERT INTO mercadopago_connections (business_id, mp_user_id, connected_at, status, account_display_name, account_email_masked) VALUES ($1, '99887766', now(), 'needs_reconnect', 'Ana S.', $2)",
      [businessA, masked],
    );
    const stored = await client.query("SELECT account_display_name, account_email_masked FROM mercadopago_connections WHERE business_id = $1", [businessA]);
    expect(stored.rows).toEqual([{ account_display_name: "Ana S.", account_email_masked: "an\u2022\u2022@gmail.com" }]);
    expect(JSON.stringify(stored.rows)).not.toContain("ana.souza@gmail.com");
  });
  it.each(["service", "customer"])("impede reserva com %s de outro negócio", async (field) => {
    await expect(client.query(
      "INSERT INTO bookings (business_id, service_id, customer_id, starts_at, ends_at, price_cents, deposit_cents, status) VALUES ($1, $2, $3, $4, $5, 5000, 1000, 'confirmed')",
      [businessA, field === "service" ? serviceB : serviceA, field === "customer" ? customerB : customerA, "2030-01-01T13:00:00Z", "2030-01-01T13:30:00Z"],
    )).rejects.toMatchObject({ code: "23503" });
  });
  it("impede pagamento vinculado a reserva alheia", async () => {
    await expect(client.query(
      "INSERT INTO payments (business_id, booking_id, provider, idempotency_key, amount_cents, expires_at) VALUES ($1, $2, 'test', $3, 1000, $4)",
      [businessB, bookingA, randomUUID(), "2030-01-01T13:00:00Z"],
    )).rejects.toMatchObject({ code: "23503" });
  });
});

describe("integridade financeira", () => {
  it("preserva centavos e preço contratado após alteração do serviço", async () => {
    await client.query("UPDATE services SET price_cents = 6000 WHERE id = $1", [serviceA]);
    const result = await client.query("SELECT price_cents, deposit_cents FROM bookings WHERE id = $1", [bookingA]);
    expect(result.rows[0]).toEqual({ price_cents: 5000, deposit_cents: 1000 });
  });
  it.each([0, -1])("impede cobrança de %s centavos", async (amount) => {
    await expect(client.query(
      "INSERT INTO payments (business_id, booking_id, provider, idempotency_key, amount_cents, expires_at) VALUES ($1, $2, 'test', $3, $4, $5)",
      [businessA, bookingA, randomUUID(), amount, "2030-01-01T13:00:00Z"],
    )).rejects.toMatchObject({ code: "23514" });
  });
  it("impede sinal maior que preço no banco", async () => {
    await expect(client.query("UPDATE services SET deposit_cents = 5001 WHERE id = $1", [serviceA])).rejects.toMatchObject({ code: "23514" });
  });
  it("impede reusar chave de idempotência", async () => {
    const key = randomUUID();
    const query = "INSERT INTO payments (business_id, booking_id, provider, idempotency_key, amount_cents, expires_at) VALUES ($1, $2, 'test', $3, 1000, $4)";
    const values = [businessA, bookingA, key, "2030-01-01T13:00:00Z"];
    await client.query(query, values);
    await expect(client.query(query, values)).rejects.toMatchObject({ code: "23505" });
  });
  it("impede marcar pagamento pago sem data", async () => {
    await expect(client.query(
      "INSERT INTO payments (business_id, booking_id, provider, idempotency_key, amount_cents, expires_at, status) VALUES ($1, $2, 'test', $3, 1000, $4, 'paid')",
      [businessA, bookingA, randomUUID(), "2030-01-01T13:00:00Z"],
    )).rejects.toMatchObject({ code: "23514" });
  });
  it("impede reserva pendente sem vencimento", async () => {
    await expect(client.query("UPDATE bookings SET status = 'pending_payment' WHERE id = $1", [bookingA])).rejects.toMatchObject({ code: "23514" });
  });
});
