import { randomUUID } from "node:crypto";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { databaseEnvSchema } from "../../lib/env";
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
