import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { createBooking } from "../../lib/bookings/service";
import { databaseEnvSchema } from "../../lib/env";
import { FakePaymentProvider } from "../../lib/payments/fake";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const provider = new FakePaymentProvider("test-only-webhook-secret-with-32-characters");
let ownerId: string;
let businessId: string;
let slug: string;
let serviceId: string;
// 2030-01-01 é terça (weekday 2); vagas de 30 min a partir de 09:00 em São Paulo (12:00Z).
const slot = (index: number) => new Date(Date.UTC(2030, 0, 1, 12, 0) + index * 1800000).toISOString();
const phone = (index: number) => `+55119${String(index).padStart(8, "0")}`;
const book = (index: number, phoneIndex: number, identity: string | null, key = randomUUID()) =>
  createBooking(slug, { serviceId, startsAt: slot(index), customer: { name: "Cliente de teste", phone: phone(phoneIndex) , cpfCnpj: "52998224725" } }, key, database, provider, identity);

beforeEach(async () => {
  ownerId = randomUUID(); businessId = randomUUID(); serviceId = randomUUID(); slug = `holds-${businessId}`;
  await database.insert(schema.user).values({ id: ownerId, name: "Dono de teste", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Negócio de teste", slug });
  await database.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
  await database.insert(schema.businessHours).values({ businessId, weekday: 2, opensAt: "09:00:00", closesAt: "18:00:00" });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await database.delete(schema.payments).where(eq(schema.payments.businessId, businessId));
  await database.delete(schema.bookings).where(eq(schema.bookings.businessId, businessId));
  await database.delete(schema.customers).where(eq(schema.customers.businessId, businessId));
  await database.delete(schema.businessHours).where(eq(schema.businessHours.businessId, businessId));
  await database.delete(schema.services).where(eq(schema.services.businessId, businessId));
  await database.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
  await database.delete(schema.user).where(eq(schema.user.id, ownerId));
});
afterAll(async () => { await pool.end(); });

async function expire(bookingId: string) {
  const past = new Date(Date.now() - 1000);
  await database.update(schema.bookings).set({ createdAt: new Date(Date.now() - 60000), expiresAt: past }).where(eq(schema.bookings.id, bookingId));
  await database.update(schema.payments).set({ expiresAt: past }).where(eq(schema.payments.bookingId, bookingId));
}

describe("limite de reservas pendentes", () => {
  it("por cliente: terceira reserva pendente do mesmo IP recebe 429 com Retry-After; outro IP segue", async () => {
    vi.stubEnv("BOOKING_MAX_PENDING_PER_CLIENT", "2");
    await book(0, 0, "peer:192.0.2.10");
    await book(1, 1, "peer:192.0.2.10");
    const error = await book(2, 2, "peer:192.0.2.10").catch((value) => value);
    expect(error).toMatchObject({ status: 429, code: "pending_hold_limit" });
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(600);
    expect((await book(2, 2, "peer:192.0.2.11")).data.status).toBe("pending_payment");
    const rows = await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, businessId));
    expect(rows).toHaveLength(3);
    for (const row of rows) { expect(row.clientHash).toMatch(/^[a-f0-9]{64}$/); expect(row.clientHash).not.toContain("192.0.2"); }
  });

  it("por telefone: mesmo telefone vindo de IPs diferentes é limitado", async () => {
    vi.stubEnv("BOOKING_MAX_PENDING_PER_PHONE", "2");
    await book(0, 7, "peer:192.0.2.20");
    await book(1, 7, "peer:192.0.2.21");
    await expect(book(2, 7, "peer:192.0.2.22")).rejects.toMatchObject({ status: 429, code: "pending_hold_limit" });
    await expect(book(2, 7, null)).rejects.toMatchObject({ status: 429, code: "pending_hold_limit" });
    expect((await book(2, 8, "peer:192.0.2.22")).data.status).toBe("pending_payment");
  });

  it("por negócio: teto global devolve 409 hold_capacity_reached", async () => {
    vi.stubEnv("BOOKING_MAX_PENDING_PER_BUSINESS", "3");
    for (let index = 0; index < 3; index++) await book(index, index, `peer:198.51.100.${index}`);
    const error = await book(3, 3, "peer:198.51.100.3").catch((value) => value);
    expect(error).toMatchObject({ status: 409, code: "hold_capacity_reached" });
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("vencimento libera a cota; reservas confirmadas e replay não contam", async () => {
    vi.stubEnv("BOOKING_MAX_PENDING_PER_CLIENT", "1");
    const key = randomUUID();
    const first = await book(0, 0, "peer:192.0.2.30", key);
    // Replay idempotente do mesmo pedido continua respondendo, mesmo com a cota cheia.
    expect((await book(0, 0, "peer:192.0.2.30", key)).replayed).toBe(true);
    await expect(book(1, 1, "peer:192.0.2.30")).rejects.toMatchObject({ status: 429 });
    await expire(first.data.bookingId);
    const second = await book(1, 1, "peer:192.0.2.30");
    expect(second.data.status).toBe("pending_payment");
    const [old] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, first.data.bookingId));
    expect(old.status).toBe("expired");
    await database.update(schema.bookings).set({ status: "confirmed" }).where(eq(schema.bookings.id, second.data.bookingId));
    expect((await book(2, 2, "peer:192.0.2.30")).data.status).toBe("pending_payment");
  });

  it("sinal zero não cria reserva pendente nem é limitado", async () => {
    vi.stubEnv("BOOKING_MAX_PENDING_PER_CLIENT", "1");
    await database.update(schema.services).set({ depositCents: 0 }).where(eq(schema.services.id, serviceId));
    for (let index = 0; index < 3; index++) expect((await book(index, index, "peer:192.0.2.40")).data.status).toBe("confirmed");
  });

  it("concorrência: o lock do negócio garante a cota exata por cliente", async () => {
    vi.stubEnv("BOOKING_MAX_PENDING_PER_CLIENT", "2");
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => book(index, index, "peer:192.0.2.50")));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ status: 429, code: "pending_hold_limit" });
    const pending = await database.select().from(schema.bookings).where(inArray(schema.bookings.status, ["pending_payment"]));
    expect(pending.filter((row) => row.businessId === businessId)).toHaveLength(2);
  });

  it("janela de reserva configurável define vencimento da reserva e da cobrança", async () => {
    vi.stubEnv("BOOKING_HOLD_MINUTES", "5");
    const before = Date.now();
    const { data } = await book(0, 0, "peer:192.0.2.60");
    const expiresAt = new Date(data.expiresAt!).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 5 * 60000 - 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60000);
    expect(new Date(data.payment!.expiresAt).getTime()).toBe(expiresAt);
  });

  it("configuração inválida torna o agendamento indisponível sem criar reserva", async () => {
    vi.stubEnv("BOOKING_HOLD_MINUTES", "999");
    await expect(book(0, 0, "peer:192.0.2.70")).rejects.toMatchObject({ status: 503, code: "booking_unavailable" });
    expect(await database.select().from(schema.bookings).where(eq(schema.bookings.businessId, businessId))).toHaveLength(0);
  });
});
