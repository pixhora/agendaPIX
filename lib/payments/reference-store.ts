import { and, eq, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import * as schema from "../../db/schema";

/**
 * Mapeamento reference (id do pagamento local) → id da cobrança no gateway.
 * Necessário para gateways sem busca por referência (Orders API do Mercado Pago):
 * findChargeByReference precisa funcionar em qualquer instância serverless, não só na que criou a cobrança.
 */
export interface ChargeReferenceStore {
  get(reference: string): Promise<string | null>;
  /** Idempotente: gravar o mesmo par de novo é no-op; nunca sobrescreve um mapeamento existente. */
  save(reference: string, externalId: string): Promise<void>;
}

/** Só para testes/dev local: não sobrevive a reinício nem é compartilhado entre instâncias. */
export class InMemoryChargeReferenceStore implements ChargeReferenceStore {
  private readonly map = new Map<string, string>();
  async get(reference: string) {
    return this.map.get(reference) ?? null;
  }
  async save(reference: string, externalId: string) {
    if (!this.map.has(reference)) this.map.set(reference, externalId);
  }
}

type Database = NodePgDatabase<typeof schema>;
const uuidSchema = z.uuid();

/**
 * Store durável em Postgres (tabela provider_charge_references).
 * Fallback de leitura: payments.external_id quando a reference é o id do pagamento — cobre cobranças
 * criadas antes desta tabela existir.
 */
export class DatabaseChargeReferenceStore implements ChargeReferenceStore {
  constructor(private readonly provider: string, private readonly database: () => Database) {}

  async get(reference: string) {
    const db = this.database();
    const [mapped] = await db.select({ externalId: schema.providerChargeReferences.externalId })
      .from(schema.providerChargeReferences)
      .where(and(eq(schema.providerChargeReferences.provider, this.provider), eq(schema.providerChargeReferences.reference, reference)))
      .limit(1);
    if (mapped) return mapped.externalId;
    if (!uuidSchema.safeParse(reference).success) return null;
    const [payment] = await db.select({ externalId: schema.payments.externalId })
      .from(schema.payments)
      .where(and(eq(schema.payments.provider, this.provider), eq(schema.payments.id, reference), isNotNull(schema.payments.externalId)))
      .limit(1);
    return payment?.externalId ?? null;
  }

  async save(reference: string, externalId: string) {
    await this.database().insert(schema.providerChargeReferences)
      .values({ provider: this.provider, reference, externalId })
      .onConflictDoNothing();
  }
}
