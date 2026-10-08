import * as schema from "../../db/schema";

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
  };
}

export async function insertConnectedMercadoPago(database: InsertDb, businessId: string) {
  await database.insert(schema.mercadopagoConnections).values(connectedMercadoPagoValues(businessId));
}
