import { createHash } from "node:crypto";
import * as schema from "../../db/schema";
import { MP_CONNECT_CONSENT_TEXT, MP_CONNECT_CONSENT_VERSION } from "../../lib/mercadopago/consent";

type InsertDb = {
  insert: (table: typeof schema.mercadopagoConnections) => {
    values: (value: typeof schema.mercadopagoConnections.$inferInsert) => Promise<unknown>;
  };
};

/** Conta Mercado Pago conectada de teste. O ciphertext é fictício e não é um token real. */
export function connectedMercadoPagoValues(businessId: string): typeof schema.mercadopagoConnections.$inferInsert {
  return {
    businessId,
    mpUserId: businessId,
    accessTokenEnc: "v1.fixture.access",
    refreshTokenEnc: "v1.fixture.refresh",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    connectedAt: new Date("2026-01-01T00:00:00.000Z"),
    status: "connected",
    consentVersion: MP_CONNECT_CONSENT_VERSION,
    consentTextSha256: createHash("sha256").update(MP_CONNECT_CONSENT_TEXT).digest("hex"),
    autoRefundAckAt: new Date("2026-10-09T12:00:00.000Z"),
    consentUserId: businessId,
  };
}

export async function insertConnectedMercadoPago(database: InsertDb, businessId: string) {
  await database.insert(schema.mercadopagoConnections).values(connectedMercadoPagoValues(businessId));
}
