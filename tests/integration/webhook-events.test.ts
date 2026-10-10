import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";
import { databaseEnvSchema } from "../../lib/env";
import { MP_CONNECT_CONSENT_TEXT, MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";
import { encryptMpToken } from "../../lib/mercadopago-oauth/crypto";
import { createDrizzleWebhookEvents, MP_CONNECT_EVENT_PROVIDER } from "../../lib/mercadopago-oauth/webhook-events";

const pool = new Pool({ connectionString: databaseEnvSchema.parse(process.env).DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
const database = drizzle(pool, { schema });
const events = createDrizzleWebhookEvents(database);
const key = "ab".repeat(32);

let ownerId: string;
let businessId: string;
let mpUserId: string;

function pgError(error: unknown): { code?: string; constraint?: string; message?: string } {
  const current = error as { code?: string; constraint?: string; message?: string; cause?: unknown };
  const nested = current?.cause ? pgError(current.cause) : {};
  return {
    code: current?.code ?? nested.code,
    constraint: current?.constraint ?? nested.constraint,
    message: [current?.message, nested.message].filter(Boolean).join("\n"),
  };
}

beforeEach(async () => {
  ownerId = randomUUID();
  businessId = randomUUID();
  mpUserId = `mp-${randomUUID()}`;
  await database.insert(schema.user).values({ id: ownerId, name: "Dono", email: `${ownerId}@example.com` });
  await database.insert(schema.businesses).values({ id: businessId, ownerId, name: "Negócio", slug: `wh-${businessId.slice(0, 8)}` });
  await database.insert(schema.mercadopagoConnections).values({
    businessId,
    mpUserId,
    accessTokenEnc: encryptMpToken("seller-access", businessId, "access", key),
    refreshTokenEnc: encryptMpToken("seller-refresh", businessId, "refresh", key),
    expiresAt: new Date("2030-06-01T00:00:00.000Z"),
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
    status: "connected",
    consentVersion: MP_CONNECT_CONSENT_VERSION,
    consentTextSha256: createHash("sha256").update(MP_CONNECT_CONSENT_TEXT).digest("hex"),
    autoRefundAckAt: new Date("2026-10-09T12:00:00.000Z"),
    consentUserId: ownerId,
  });
});

afterEach(async () => {
  await pool.query("DROP TRIGGER IF EXISTS fail_mp_connection_update ON mercadopago_connections");
  await pool.query("DROP FUNCTION IF EXISTS fail_mp_connection_update()");
  await database.delete(schema.webhookEvents).where(eq(schema.webhookEvents.provider, MP_CONNECT_EVENT_PROVIDER));
  await database.delete(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessId));
  await database.delete(schema.businesses).where(eq(schema.businesses.id, businessId));
  await database.delete(schema.user).where(eq(schema.user.id, ownerId));
});

afterAll(async () => {
  await pool.end();
});

describe("webhook_events no Postgres", () => {
  it("a mesma entrega duas vezes produz um só efeito", async () => {
    const requestId = `req-${randomUUID()}`;
    const first = await events.deauthorize(requestId, mpUserId);
    const [afterFirst] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessId));
    const second = await events.deauthorize(requestId, mpUserId);
    const [afterSecond] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessId));
    const rows = await database.select().from(schema.webhookEvents).where(and(
      eq(schema.webhookEvents.provider, MP_CONNECT_EVENT_PROVIDER),
      eq(schema.webhookEvents.requestId, requestId),
    ));

    expect(first).toMatchObject({ kind: "applied", businessIds: [businessId] });
    expect(second).toEqual({ kind: "duplicate" });
    expect(rows).toHaveLength(1);
    expect(afterFirst?.status).toBe("needs_reconnect");
    expect(afterFirst?.accessTokenEnc).toBeNull();
    expect(afterSecond?.status).toBe("needs_reconnect");
    expect(afterSecond?.updatedAt.getTime()).toBe(afterFirst?.updatedAt.getTime());
  });

  it("falha no update desfaz a linha da entrega", async () => {
    const requestId = `req-${randomUUID()}`;
    await pool.query(`
      CREATE OR REPLACE FUNCTION fail_mp_connection_update() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced_update_failure';
      END;
      $$
    `);
    await pool.query(`
      CREATE TRIGGER fail_mp_connection_update
      BEFORE UPDATE ON mercadopago_connections
      FOR EACH ROW EXECUTE FUNCTION fail_mp_connection_update()
    `);

    await expect(events.deauthorize(requestId, mpUserId)).rejects.toSatisfy((error: unknown) => pgError(error).message?.includes("forced_update_failure") === true);

    const rows = await database.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.requestId, requestId));
    const [connection] = await database.select().from(schema.mercadopagoConnections).where(eq(schema.mercadopagoConnections.businessId, businessId));
    expect(rows).toHaveLength(0);
    expect(connection?.status).toBe("connected");
    expect(connection?.accessTokenEnc).not.toBeNull();
  });

  it("recusa provider ou request id vazio", async () => {
    for (const values of [
      { provider: "", requestId: "req-vazio" },
      { provider: "mercadopago", requestId: "" },
      { provider: " ", requestId: "req-espaco" },
      { provider: "mercadopago", requestId: "   " },
    ]) {
      try {
        await database.insert(schema.webhookEvents).values(values);
        throw new Error(`insert aceitou id vazio: ${JSON.stringify(values)}`);
      } catch (error) {
        const pg = pgError(error);
        expect(pg.code).toBe("23514");
        expect(pg.constraint).toBe("webhook_events_id_not_empty");
      }
    }
  });
});
