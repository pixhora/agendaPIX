import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { bookingConfig } from "../bookings/config";

/** "1 minuto" ou "30 minutos". A landing não escreve o número no código. */
export function formatMinutes(minutes: number) {
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

/** Padrão false. `true` só se a env pedir CPF. A doc oficial não fecha a questão para Pix. */
export function payerCpfRequired(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.MP_REQUIRES_PAYER_CPF === "true";
}

/** Nome do dono; se vier vazio, o nome do negócio. */
export function resolvePixRecipientDisplayName(ownerName: string | null | undefined, businessName: string | null | undefined) {
  const owner = ownerName?.trim() ?? "";
  if (owner.length > 0) return owner;
  const business = businessName?.trim() ?? "";
  return business.length > 0 ? business : null;
}

export type PublicBookingFacts = {
  holdMinutes: number;
  pixRecipientDisplayName: string | null;
  requiresPayerCpf: boolean;
};

/**
 * Fatos públicos do agendamento. `holdMinutes` é `BOOKING_HOLD_MINUTES`.
 * Sem `businessId` (landing) o recebedor é null: o Pix cai na conta do dono.
 * Com `businessId`, o nome é o do dono, com fallback para o nome do negócio.
 */
export async function getPublicBookingFacts(businessId?: string): Promise<PublicBookingFacts> {
  const holdMinutes = bookingConfig().BOOKING_HOLD_MINUTES;
  const requiresPayerCpf = payerCpfRequired();
  if (!businessId || !z.uuid().safeParse(businessId).success) {
    return { holdMinutes, pixRecipientDisplayName: null, requiresPayerCpf };
  }
  const [row] = await getDb().select({
    businessName: schema.businesses.name,
    ownerName: schema.user.name,
  }).from(schema.businesses)
    .innerJoin(schema.user, eq(schema.user.id, schema.businesses.ownerId))
    .where(eq(schema.businesses.id, businessId))
    .limit(1);
  return {
    holdMinutes,
    pixRecipientDisplayName: resolvePixRecipientDisplayName(row?.ownerName, row?.businessName),
    requiresPayerCpf,
  };
}
