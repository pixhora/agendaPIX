import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { databaseEnvSchema } from "../../lib/env";
import { MercadoPagoPaymentProvider } from "../../lib/payments/mercadopago";
import { chargeCustomerSchema } from "../../lib/payments/provider";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });

const mpEnv = {
  MERCADOPAGO_ACCESS_TOKEN: "APP_USR-test-access-token-ok",
  MERCADOPAGO_ENV: "sandbox" as const,
  MERCADOPAGO_WEBHOOK_SECRET: "test-webhook-secret-at-least-32-characters-long-ok",
};

const customer = chargeCustomerSchema.parse({
  name: "João da Silva", phone: "+5511912345678", cpfCnpj: "08817934040", email: "joao@example.com",
});

describe("Mercado Pago reference persistence", () => {
  const createdRefs: string[] = [];
  const now = new Date("2026-10-06T12:00:00Z");

  beforeAll(async () => {
    await pool.query("BEGIN");
  });

  afterEach(async () => {
    if (createdRefs.length > 0) {
      await database.delete(schema.paymentProviderReferences)
        .where(inArray(schema.paymentProviderReferences.reference, createdRefs));
      createdRefs.length = 0;
    }
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await pool.query("ROLLBACK");
    await pool.end();
  });

  it("persists reference→orderId mapping on createPixCharge", async () => {
    const reference = randomUUID();
    createdRefs.push(reference);
    const orderId = `ORDTST${Date.now()}`;

    // Mock fetch para simular criação de order
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: orderId,
        status: "action_required",
        external_reference: reference,
        total_amount: "10.00",
        date_created: now.toISOString(),
        transactions: {
          payments: [{
            id: `PAY${Date.now()}`,
            status: "pending",
            amount: "10.00",
            payment_method: { id: "pix", type: "bank_transfer", qr_code: "00020126" },
          }],
        },
      }), { status: 200 })
    );

    const provider = new MercadoPagoPaymentProvider({
      accessToken: mpEnv.MERCADOPAGO_ACCESS_TOKEN,
      webhookSecret: mpEnv.MERCADOPAGO_WEBHOOK_SECRET,
      env: mpEnv.MERCADOPAGO_ENV,
      fetchImpl: fetchMock as never,
      now: () => now,
      database,
    });

    await provider.createPixCharge({
      idempotencyKey: randomUUID(),
      reference,
      amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000),
      customer,
    });

    // Verifica que foi persistido
    const [persisted] = await database.select()
      .from(schema.paymentProviderReferences)
      .where(eq(schema.paymentProviderReferences.reference, reference))
      .limit(1);

    expect(persisted).toMatchObject({
      provider: "mercadopago",
      reference,
      externalId: orderId.toLowerCase(),
    });
  });

  it("findChargeByReference reads from database across instances", async () => {
    const reference = randomUUID();
    createdRefs.push(reference);
    const orderId = `ORDTST${Date.now()}`;

    // Insere mapping direto no banco (simula outra instância)
    await database.insert(schema.paymentProviderReferences).values({
      provider: "mercadopago",
      reference,
      externalId: orderId.toLowerCase(),
    });

    // Mock fetch para simular consulta do order
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: orderId,
        status: "processed",
        external_reference: reference,
        total_amount: "15.00",
        date_created: now.toISOString(),
        date_closed: now.toISOString(),
        transactions: {
          payments: [{
            id: `PAY${Date.now()}`,
            status: "approved",
            amount: "15.00",
            date_approved: now.toISOString(),
            payment_method: { id: "pix", type: "bank_transfer", qr_code: "00020126" },
          }],
        },
      }), { status: 200 })
    );

    const provider = new MercadoPagoPaymentProvider({
      accessToken: mpEnv.MERCADOPAGO_ACCESS_TOKEN,
      webhookSecret: mpEnv.MERCADOPAGO_WEBHOOK_SECRET,
      env: mpEnv.MERCADOPAGO_ENV,
      fetchImpl: fetchMock as never,
      now: () => now,
      database,
    });

    const charge = await provider.findChargeByReference(reference);

    expect(charge).toMatchObject({
      externalId: orderId,
      reference,
      status: "paid",
      amountCents: 1500,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/v1/orders/${orderId.toLowerCase()}`),
      expect.any(Object)
    );
  });

  it("handles race condition on reference conflict (idempotency)", async () => {
    const reference = randomUUID();
    createdRefs.push(reference);
    const orderId = `ORDTST${Date.now()}`;

    // Insere mapping direto (primeira instância já criou)
    await database.insert(schema.paymentProviderReferences).values({
      provider: "mercadopago",
      reference,
      externalId: orderId.toLowerCase(),
    });

    // Mock: POST retorna erro 4xx, fallback busca por reference
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "conflict" }), { status: 409 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          id: orderId,
          status: "action_required",
          external_reference: reference,
          total_amount: "10.00",
          date_created: now.toISOString(),
          transactions: {
            payments: [{
              id: `PAY${Date.now()}`,
              status: "pending",
              amount: "10.00",
              payment_method: { id: "pix", type: "bank_transfer", qr_code: "00020126" },
            }],
          },
        }), { status: 200 })
      );

    const provider = new MercadoPagoPaymentProvider({
      accessToken: mpEnv.MERCADOPAGO_ACCESS_TOKEN,
      webhookSecret: mpEnv.MERCADOPAGO_WEBHOOK_SECRET,
      env: mpEnv.MERCADOPAGO_ENV,
      fetchImpl: fetchMock as never,
      now: () => now,
      database,
    });

    const charge = await provider.createPixCharge({
      idempotencyKey: randomUUID(),
      reference,
      amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000),
      customer,
    });

    expect(charge.externalId).toBe(orderId);
    expect(fetchMock).toHaveBeenCalledTimes(2); // POST + GET fallback
  });

  it("returns null when reference is not found", async () => {
    const provider = new MercadoPagoPaymentProvider({
      accessToken: mpEnv.MERCADOPAGO_ACCESS_TOKEN,
      webhookSecret: mpEnv.MERCADOPAGO_WEBHOOK_SECRET,
      env: mpEnv.MERCADOPAGO_ENV,
      fetchImpl: vi.fn() as never,
      now: () => now,
      database,
    });

    const charge = await provider.findChargeByReference(randomUUID());
    expect(charge).toBeNull();
  });

  it("works without database (backward compatibility)", async () => {
    const reference = randomUUID();
    const orderId = `ORDTST${Date.now()}`;

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: orderId,
        status: "action_required",
        external_reference: reference,
        total_amount: "10.00",
        date_created: now.toISOString(),
        transactions: {
          payments: [{
            id: `PAY${Date.now()}`,
            status: "pending",
            amount: "10.00",
            payment_method: { id: "pix", type: "bank_transfer", qr_code: "00020126" },
          }],
        },
      }), { status: 200 })
    );

    // Instancia provider SEM database
    const provider = new MercadoPagoPaymentProvider({
      accessToken: mpEnv.MERCADOPAGO_ACCESS_TOKEN,
      webhookSecret: mpEnv.MERCADOPAGO_WEBHOOK_SECRET,
      env: mpEnv.MERCADOPAGO_ENV,
      fetchImpl: fetchMock as never,
      now: () => now,
    });

    const charge = await provider.createPixCharge({
      idempotencyKey: randomUUID(),
      reference,
      amountCents: 1000,
      expiresAt: new Date(now.getTime() + 40 * 60_000),
      customer,
    });

    expect(charge.externalId).toBe(orderId);

    // findChargeByReference retorna null (sem banco = sem cache)
    const found = await provider.findChargeByReference(reference);
    expect(found).toBeNull();
  });
});
