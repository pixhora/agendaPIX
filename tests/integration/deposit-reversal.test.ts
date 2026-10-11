import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema";
import { databaseEnvSchema } from "../../lib/env";
import { dashboardBookings } from "../../lib/dashboard/data";
import { acknowledgeDepositReversal } from "../../lib/payments/deposit-reversal-ack";
import { applyPaidEvent } from "../../lib/payments/apply-paid";
import { ObservedPartialRefundEvent, ObservedRefundEvent, type PaymentProvider } from "../../lib/payments/provider";
import { drizzleRefundPorts, settleAutomaticLateRefund } from "../../lib/payments/refund-flow";
import { processWebhook } from "../../lib/payments/webhook";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL });
let client: PoolClient;
let database: NodePgDatabase<typeof schema>;
let ownerA: string;
let ownerB: string;
let businessA: string;
let businessB: string;
let captureDir: string;

beforeEach(async () => {
  client = await pool.connect();
  await client.query("BEGIN");
  database = drizzle(client, { schema });
  ownerA = randomUUID();
  ownerB = randomUUID();
  businessA = randomUUID();
  businessB = randomUUID();
  slot = 0;
  captureDir = await mkdtemp(path.join(tmpdir(), "deposit-mail-"));
  process.env.MAGIC_LINK_CAPTURE_FILE = path.join(captureDir, "mail.txt");
  await database.insert(schema.user).values([
    { id: ownerA, name: "Dono A", email: `${ownerA}@example.com` },
    { id: ownerB, name: "Dono B", email: `${ownerB}@example.com` },
  ]);
  await database.insert(schema.businesses).values([
    { id: businessA, ownerId: ownerA, name: "Negócio A", slug: `a-${businessA.slice(0, 8)}`, timezone: "America/Sao_Paulo" },
    { id: businessB, ownerId: ownerB, name: "Negócio B", slug: `b-${businessB.slice(0, 8)}`, timezone: "America/Sao_Paulo" },
  ]);
});
afterEach(async () => {
  delete process.env.MAGIC_LINK_CAPTURE_FILE;
  if (client) {
    await client.query("ROLLBACK");
    client.release();
  }
  await rm(captureDir, { recursive: true, force: true });
});
afterAll(async () => { await pool.end(); });

let slot = 0;
async function seedConfirmed(businessId: string, externalId = `mp-${randomUUID()}`) {
  slot += 1;
  const serviceId = randomUUID();
  await database.insert(schema.services).values({
    id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000,
  });
  const [customer] = await database.insert(schema.customers).values({
    businessId, name: "Ana", phone: `+551198000${String(slot).padStart(4, "0")}`, email: "ana@example.com",
  }).returning();
  const [booking] = await database.insert(schema.bookings).values({
    businessId, serviceId, customerId: customer.id,
    startsAt: new Date(Date.UTC(2030, 0, 2, 12 + slot, 0, 0)),
    endsAt: new Date(Date.UTC(2030, 0, 2, 12 + slot, 30, 0)),
    priceCents: 5000, depositCents: 1000, status: "confirmed",
  }).returning();
  const [payment] = await database.insert(schema.payments).values({
    businessId, bookingId: booking.id, provider: "mercadopago", externalId,
    idempotencyKey: randomUUID(), amountCents: 1000, status: "paid",
    paidAt: new Date("2030-01-01T12:00:00.000Z"),
    expiresAt: new Date("2030-01-01T12:30:00.000Z"),
  }).returning();
  return { booking, payment, externalId };
}

function gateway(externalId: string, kind: "refunded" | "charged_back" | "partial"): PaymentProvider {
  return {
    name: "mercadopago",
    async verifyWebhook() {
      if (kind === "partial") throw new ObservedPartialRefundEvent(externalId);
      throw new ObservedRefundEvent(externalId, kind);
    },
    async createPixCharge() { throw new Error("fora do teste"); },
    async getCharge() { return null; },
    async findChargeByReference() { return null; },
    async cancelCharge() { return null; },
    async refundCharge() { return null; },
  };
}

function webhook(externalId: string) {
  return new Request("http://localhost/api/webhooks/payments/mercadopago", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1, type: "payment", status: "approved", data: { id: externalId } }),
  });
}

async function mailText() {
  return readFile(process.env.MAGIC_LINK_CAPTURE_FILE ?? "", "utf8").catch(() => "");
}

describe("sinal devolvido ou contestado", () => {
  it("grava estorno total sem cancelar e ignora replay", async () => {
    const { booking, externalId } = await seedConfirmed(businessA);
    const provider = gateway(externalId, "refunded");
    const request = webhook(externalId);
    expect(await processWebhook(request, "mercadopago", database, provider)).toMatchObject({ outcome: "ignored", reason: "refund_observed" });
    expect(await processWebhook(request, "mercadopago", database, provider)).toMatchObject({ outcome: "ignored", reason: "refund_observed" });
    const [stored] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
    expect(stored.status).toBe("confirmed");
    expect(stored.depositReversalReason).toBe("refunded");
    expect(stored.depositReversedAt).toBeInstanceOf(Date);
    expect(stored.depositReversalSeenAt).toBeNull();
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.bookingId, booking.id));
    expect(payment.status).toBe("refunded");
    const notices = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.bookingId, booking.id));
    expect(notices.filter((row) => row.action === "notice_deposit_reversed")).toHaveLength(1);
    expect(await mailText()).toContain("Sinal devolvido");
    const agenda = await dashboardBookings(ownerA, businessA, ["2030-01-02"], database);
    expect(agenda.bookings[0]?.depositStatus).toBe("refunded");
    expect(agenda.reversedDepositsPendingCount).toBe(1);
  });

  it("grava contestação e um approved posterior não volta o sinal para pago", async () => {
    const { booking, payment, externalId } = await seedConfirmed(businessA);
    await processWebhook(webhook(externalId), "mercadopago", database, gateway(externalId, "charged_back"));
    await processWebhook(webhook(externalId), "mercadopago", database, gateway(externalId, "refunded"));
    const paid = await applyPaidEvent(database, "mercadopago", {
      eventId: `later-${randomUUID()}`,
      type: "payment.paid",
      externalId,
      amountCents: 1000,
      paidAt: "2030-01-03T12:00:00.000Z",
      paidAtSource: "date_approved",
    });
    expect(paid.reason).toBe("deposit_reversal_terminal");
    const [stored] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
    expect(stored.status).toBe("confirmed");
    expect(stored.depositReversalReason).toBe("charged_back");
    const [updated] = await database.select().from(schema.payments).where(eq(schema.payments.id, payment.id));
    expect(updated.status).toBe("refunded");
    expect((await dashboardBookings(ownerA, businessA, ["2030-01-02"], database)).bookings[0]?.depositStatus).toBe("charged_back");
    expect(await mailText()).toContain("Pix contestado");
    expect(await mailText()).not.toContain("Sinal devolvido");
  });

  it("devolução parcial só audita", async () => {
    const { booking, externalId } = await seedConfirmed(businessA);
    const provider = gateway(externalId, "partial");
    expect(await processWebhook(webhook(externalId), "mercadopago", database, provider)).toMatchObject({ reason: "partial_refund_observed" });
    expect(await processWebhook(webhook(externalId), "mercadopago", database, provider)).toMatchObject({ reason: "partial_refund_observed" });
    const [stored] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
    expect(stored.status).toBe("confirmed");
    expect(stored.depositReversedAt).toBeNull();
    expect(stored.depositReversalReason).toBeNull();
    const [payment] = await database.select().from(schema.payments).where(eq(schema.payments.bookingId, booking.id));
    expect(payment.status).toBe("paid");
    const audits = await database.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.bookingId, booking.id));
    expect(audits.filter((row) => row.action === "partial_refund_observed")).toHaveLength(1);
    expect(await mailText()).toBe("");
    expect((await dashboardBookings(ownerA, businessA, ["2030-01-02"], database)).bookings[0]?.depositStatus).toBe("paid");
  });

  it("duas entregas simultâneas deixam um só motivo e a reserva confirmada", async () => {
    const live = drizzle(pool, { schema });
    const externalId = `mp-race-${randomUUID()}`;
    const ownerId = randomUUID();
    const businessId = randomUUID();
    const serviceId = randomUUID();
    const bookingId = randomUUID();
    const customerId = randomUUID();
    await live.insert(schema.user).values({ id: ownerId, name: "Dono", email: `${ownerId}@example.com` });
    await live.insert(schema.businesses).values({ id: businessId, ownerId, name: "Corrida", slug: `race-${businessId.slice(0, 8)}`, timezone: "America/Sao_Paulo" });
    await live.insert(schema.services).values({ id: serviceId, businessId, name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 });
    await live.insert(schema.customers).values({ id: customerId, businessId, name: "Ana", phone: "+5511980009999" });
    await live.insert(schema.bookings).values({
      id: bookingId, businessId, serviceId, customerId,
      startsAt: new Date("2030-01-02T18:00:00.000Z"), endsAt: new Date("2030-01-02T18:30:00.000Z"),
      priceCents: 5000, depositCents: 1000, status: "confirmed",
    });
    await live.insert(schema.payments).values({
      businessId, bookingId, provider: "mercadopago", externalId, idempotencyKey: randomUUID(),
      amountCents: 1000, status: "paid", paidAt: new Date("2030-01-01T12:00:00.000Z"),
      expiresAt: new Date("2030-01-01T12:30:00.000Z"),
    });
    try {
      const provider = gateway(externalId, "refunded");
      const results = await Promise.all([
        processWebhook(webhook(externalId), "mercadopago", live, provider),
        processWebhook(webhook(externalId), "mercadopago", live, provider),
      ]);
      expect(results.every((row) => row.reason === "refund_observed")).toBe(true);
      const [stored] = await live.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
      expect(stored.status).toBe("confirmed");
      expect(stored.depositReversalReason).toBe("refunded");
      const notices = await live.select().from(schema.paymentAudit).where(eq(schema.paymentAudit.action, "notice_deposit_reversed"));
      expect(notices.filter((row) => row.bookingId === bookingId)).toHaveLength(1);
    } finally {
      await live.delete(schema.paymentAudit).where(eq(schema.paymentAudit.businessId, businessId));
      await live.delete(schema.payments).where(eq(schema.payments.businessId, businessId));
      await live.delete(schema.bookings).where(eq(schema.bookings.businessId, businessId));
      await live.delete(schema.customers).where(eq(schema.customers.businessId, businessId));
      await live.delete(schema.services).where(eq(schema.services.businessId, businessId));
      await live.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
      await live.delete(schema.user).where(eq(schema.user.id, ownerId));
    }
  });

  it("estorno tardio do AgendaPix não gera o aviso de sinal devolvido", async () => {
    const { booking, payment, externalId } = await seedConfirmed(businessA);
    await database.insert(schema.paymentRefunds).values({
      businessId: businessA, paymentId: payment.id, bookingId: booking.id, amountCents: 1000,
      kind: "auto_late", status: "processing", idempotencyKey: `auto_late:${payment.id}`,
    });
    await processWebhook(webhook(externalId), "mercadopago", database, gateway(externalId, "refunded"));
    const [stored] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
    expect(stored.status).toBe("confirmed");
    expect(stored.depositReversedAt).toBeNull();
    const [updated] = await database.select().from(schema.payments).where(eq(schema.payments.id, payment.id));
    expect(updated.status).toBe("refunded");
    expect(await mailText()).not.toContain("Sinal devolvido");
    expect(await mailText()).not.toContain("Pix contestado");
    const agenda = await dashboardBookings(ownerA, businessA, ["2030-01-02"], database);
    expect(agenda.bookings[0]?.depositStatus).toBe("auto_refunded");
    expect(agenda.reversedDepositsPendingCount).toBe(0);

    const late = await seedConfirmed(businessA, `mp-late-${randomUUID()}`);
    await database.insert(schema.paymentAudit).values({
      businessId: businessA, paymentId: late.payment.id, bookingId: late.booking.id, action: "late_no_slot",
      detail: { cause: "window_expired", reason: "late_no_slot" },
    });
    const mailer = vi.fn(async () => {});
    expect(await settleAutomaticLateRefund(drizzleRefundPorts(database), {
      refundCharge: async () => ({ status: "refunded", refundId: "auto-1" }),
    }, late.payment.id, mailer)).toBe("submitted");
    const [lateBooking] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, late.booking.id));
    expect(lateBooking.depositReversedAt).toBeNull();
    expect(lateBooking.status).toBe("confirmed");
    expect(mailer.mock.calls[0]?.[1]).toBe("Sinal devolvido pelo AgendaPix");
  });

  it("sem SMTP o webhook grava o estorno e não falha", async () => {
    const previous = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    delete process.env.MAGIC_LINK_CAPTURE_FILE;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { booking, externalId } = await seedConfirmed(businessA);
      await expect(processWebhook(webhook(externalId), "mercadopago", database, gateway(externalId, "refunded"))).resolves.toMatchObject({ reason: "refund_observed" });
      const [stored] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
      expect(stored.depositReversalReason).toBe("refunded");
      expect(stored.status).toBe("confirmed");
      expect(errorLog.mock.calls.map((call) => call.join(" ")).join("\n")).toContain("[mail] scope=deposit_reversal code=send_failed");
    } finally {
      errorLog.mockRestore();
      if (previous === undefined) delete process.env.SMTP_HOST;
      else process.env.SMTP_HOST = previous;
    }
  });

  it("dono A não confirma aviso de reserva do negócio B", async () => {
    const foreign = await seedConfirmed(businessB);
    await database.update(schema.bookings).set({
      depositReversedAt: new Date("2030-01-02T12:00:00.000Z"),
      depositReversalReason: "refunded",
    }).where(eq(schema.bookings.id, foreign.booking.id));
    await expect(acknowledgeDepositReversal(database, {
      ownerId: ownerA, businessId: businessB, bookingId: foreign.booking.id,
    })).rejects.toMatchObject({ status: 404 });
    await expect(acknowledgeDepositReversal(database, {
      ownerId: ownerA, businessId: businessA, bookingId: foreign.booking.id,
    })).rejects.toMatchObject({ status: 404 });
    const [untouched] = await database.select().from(schema.bookings).where(eq(schema.bookings.id, foreign.booking.id));
    expect(untouched.depositReversalSeenAt).toBeNull();
  });

  it("o dono marca como visto uma vez e a contagem zera", async () => {
    const { booking, externalId } = await seedConfirmed(businessA);
    await processWebhook(webhook(externalId), "mercadopago", database, gateway(externalId, "refunded"));
    const first = await acknowledgeDepositReversal(database, { ownerId: ownerA, businessId: businessA, bookingId: booking.id });
    const second = await acknowledgeDepositReversal(database, { ownerId: ownerA, businessId: businessA, bookingId: booking.id });
    expect(first.depositStatus).toBe("refunded");
    expect(second.depositReversalSeenAt).toBe(first.depositReversalSeenAt);
    const agenda = await dashboardBookings(ownerA, businessA, ["2030-01-02"], database);
    expect(agenda.reversedDepositsPendingCount).toBe(0);
    expect(agenda.bookings[0]?.depositStatus).toBe("refunded");
    expect(agenda.bookings[0]?.depositReversalSeenAt).toBe(first.depositReversalSeenAt);
  });

  it("sem as colunas novas a agenda deriva o status e avisa", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { booking } = await seedConfirmed(businessA);
      await client.query("ALTER TABLE bookings RENAME COLUMN deposit_reversed_at TO deposit_reversed_at_hidden");
      await client.query("ALTER TABLE bookings RENAME COLUMN deposit_reversal_reason TO deposit_reversal_reason_hidden");
      await client.query("ALTER TABLE bookings RENAME COLUMN deposit_reversal_seen_at TO deposit_reversal_seen_at_hidden");
      const agenda = await dashboardBookings(ownerA, businessA, ["2030-01-02"], database);
      expect(agenda.bookings.map((row) => row.id)).toContain(booking.id);
      expect(agenda.bookings.find((row) => row.id === booking.id)?.depositStatus).toBe("paid");
      expect(agenda.reversedDepositsPendingCount).toBe(0);
      expect(warn.mock.calls.map((call) => String(call[0])).join("\n")).toContain("42703");
    } finally {
      warn.mockRestore();
    }
  });
});
