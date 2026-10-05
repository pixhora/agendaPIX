import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { businessPixKeys } from "../../db/schema";
import { HttpError } from "../http";
import { findOwnedBusiness } from "../tenancy";
import { encryptPixKey, normalizePixKey, pixKeyHint, pixKeyInputSchema } from "./crypto";

type PixKeyDatabase = Pick<ReturnType<typeof getDb>, "select" | "insert" | "delete">;

export async function getBusinessPixKey(businessId: string, ownerId: string, database: PixKeyDatabase = getDb()) {
  const business = await findOwnedBusiness(businessId, ownerId, database);
  if (!business) throw new HttpError(404, "business_not_found", "Negócio não encontrado.");
  const [saved] = await database.select({ type: businessPixKeys.type, hint: businessPixKeys.hint }).from(businessPixKeys).where(eq(businessPixKeys.businessId, business.id)).limit(1);
  return { configured: Boolean(saved), type: saved?.type ?? null, hint: saved?.hint ?? null };
}

export async function setBusinessPixKey(businessId: string, ownerId: string, input: unknown, database: PixKeyDatabase = getDb()) {
  const business = await findOwnedBusiness(businessId, ownerId, database);
  if (!business) throw new HttpError(404, "business_not_found", "Negócio não encontrado.");
  const parsed = pixKeyInputSchema.parse(input);
  const normalized = normalizePixKey(parsed.type, parsed.value);
  if (!process.env.PIX_KEY_ENCRYPTION_KEY) throw new HttpError(503, "pix_key_storage_unavailable", "O armazenamento seguro da chave Pix ainda não está configurado.");
  let encrypted: ReturnType<typeof encryptPixKey>;
  try { encrypted = encryptPixKey(normalized.value, business.id); }
  catch { throw new HttpError(503, "pix_key_storage_unavailable", "O armazenamento seguro da chave Pix ainda não está configurado."); }
  await database.insert(businessPixKeys).values({ businessId: business.id, type: normalized.type, hint: pixKeyHint(normalized.type, normalized.value), ...encrypted }).onConflictDoUpdate({
    target: businessPixKeys.businessId,
    set: { type: normalized.type, hint: pixKeyHint(normalized.type, normalized.value), ...encrypted, updatedAt: new Date() },
  });
  return { configured: true, type: normalized.type, hint: pixKeyHint(normalized.type, normalized.value) };
}

export async function deleteBusinessPixKey(businessId: string, ownerId: string, database: PixKeyDatabase = getDb()) {
  const business = await findOwnedBusiness(businessId, ownerId, database);
  if (!business) throw new HttpError(404, "business_not_found", "Negócio não encontrado.");
  await database.delete(businessPixKeys).where(eq(businessPixKeys.businessId, business.id));
  return { configured: false, type: null, hint: null };
}
