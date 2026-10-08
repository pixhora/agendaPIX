import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { businesses, onboardingDrafts, onboardingRequests, verification, type OnboardingDraftData } from "../../db/schema";
import { requestKeySchema } from "../bookings/validation";
import { HttpError } from "../http";
import { ONBOARDING_SEGMENTS, suggestFreeSlugs } from "../slug-availability";
import { normalizeSlug } from "../slug";
import { onboardingInputSchema } from "./validation";
import { maskEmail } from "./draft-cookie";
import { oneBusinessPerOwner } from "./owner-policy";

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const draftEnvelopeSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  segment: z.enum(ONBOARDING_SEGMENTS),
  plan: z.enum(["base", "completo"]),
  data: z.unknown(),
}).strict();

const draftPatchSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()).optional(),
  data: z.unknown().optional(),
}).strict().refine((value) => value.email !== undefined || value.data !== undefined, { message: "Nada para atualizar." });

export type DraftReader = { cookieId: string | null; sessionEmail: string | null };
export type DraftOwner = { userId: string; email: string };

type Database = ReturnType<typeof getDb>;
type DraftRow = typeof onboardingDrafts.$inferSelect;

/** Identificador do plugin emailOTP 1.7.7: `toOTPIdentifier("sign-in", email)`. */
export function signInOtpIdentifier(email: string) {
  return `sign-in-otp-${email.trim().toLowerCase()}`;
}

function invalidInput(error: z.ZodError, prefix?: string): never {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = [...(prefix ? [prefix] : []), ...issue.path].join(".") || "_";
    if (!fields[path]) fields[path] = issue.message === "slug_reserved" ? "Esse nome é reservado." : issue.message;
  }
  throw new HttpError(400, "invalid_input", "Confira os dados enviados.", undefined, { fields });
}

function normalizeDraftSlug(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  const business = record.business;
  if (!business || typeof business !== "object" || Array.isArray(business)) return data;
  const slug = (business as { slug?: unknown }).slug;
  if (typeof slug !== "string") return data;
  return { ...record, business: { ...(business as Record<string, unknown>), slug: normalizeSlug(slug, { final: true }) } };
}

function parseDraftData(data: unknown): OnboardingDraftData {
  const parsed = onboardingInputSchema.safeParse(normalizeDraftSlug(data));
  if (!parsed.success) invalidInput(parsed.error, "data");
  if (parsed.data.business.slug.length < 3) {
    throw new HttpError(400, "invalid_input", "Confira os dados enviados.", undefined, {
      fields: { "data.business.slug": "Use pelo menos 3 caracteres." },
    });
  }
  return parsed.data;
}

async function assertSlugFree(slug: string, segment: string | null, database: Database) {
  const [row] = await database.select({ slug: businesses.slug }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!row) return;
  throw new HttpError(409, "slug_unavailable", "Esse endereço já está em uso. Escolha outro.", undefined, {
    suggestions: await suggestFreeSlugs(slug, segment, database),
  });
}

function present(draft: DraftRow) {
  return {
    draftId: draft.id,
    email: maskEmail(draft.email),
    segment: draft.segment,
    plan: draft.plan,
    data: draft.data,
    expiresAt: draft.expiresAt.toISOString(),
  };
}

async function loadDraft(id: string, database: Database) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new HttpError(404, "not_found", "Cadastro não encontrado.");
  const [draft] = await database.select().from(onboardingDrafts).where(eq(onboardingDrafts.id, parsed.data)).limit(1);
  if (!draft) throw new HttpError(404, "not_found", "Cadastro não encontrado.");
  return draft;
}

function canRead(draft: DraftRow, reader: DraftReader) {
  if (reader.cookieId === draft.id) return true;
  return reader.sessionEmail !== null && reader.sessionEmail.toLowerCase() === draft.email;
}

async function readableDraft(id: string, reader: DraftReader, database: Database) {
  const draft = await loadDraft(id, database);
  if (!canRead(draft, reader)) throw new HttpError(404, "not_found", "Cadastro não encontrado.");
  if (draft.expiresAt.getTime() <= Date.now()) throw new HttpError(410, "draft_expired", "Seu cadastro guardado venceu.");
  return draft;
}

export async function createOnboardingDraft(body: unknown, database: Database = getDb()) {
  const envelope = draftEnvelopeSchema.safeParse(body);
  if (!envelope.success) invalidInput(envelope.error);
  const data = parseDraftData(envelope.data.data);
  await assertSlugFree(data.business.slug, envelope.data.segment, database);
  const now = new Date();
  const id = randomUUID();
  requestKeySchema.parse(id);
  const expiresAt = new Date(now.getTime() + DRAFT_TTL_MS);
  await database.insert(onboardingDrafts).values({
    id,
    email: envelope.data.email,
    segment: envelope.data.segment,
    plan: envelope.data.plan,
    data,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  });
  return { draftId: id, expiresAt: expiresAt.toISOString() };
}

export async function readOnboardingDraft(id: string, reader: DraftReader, database: Database = getDb()) {
  return present(await readableDraft(id, reader, database));
}

export async function updateOnboardingDraft(id: string, body: unknown, reader: DraftReader, database: Database = getDb()) {
  const draft = await readableDraft(id, reader, database);
  if (draft.consumedAt) throw new HttpError(409, "draft_consumed", "Esse cadastro já virou uma página.");
  const patch = draftPatchSchema.safeParse(body);
  if (!patch.success) invalidInput(patch.error);
  let email = draft.email;
  let data = draft.data;
  if (patch.data.email && patch.data.email !== draft.email) {
    await database.delete(verification).where(eq(verification.identifier, signInOtpIdentifier(draft.email)));
    email = patch.data.email;
  }
  if (patch.data.data !== undefined) {
    data = parseDraftData(patch.data.data);
    await assertSlugFree(data.business.slug, draft.segment, database);
  }
  const [updated] = await database.update(onboardingDrafts).set({ email, data, updatedAt: new Date() }).where(eq(onboardingDrafts.id, draft.id)).returning();
  return present(updated);
}

async function markConsumed(draftId: string, businessId: string, database: Database) {
  await database.update(onboardingDrafts).set({
    consumedAt: sql`coalesce(${onboardingDrafts.consumedAt}, now())`,
    businessId,
    updatedAt: new Date(),
  }).where(eq(onboardingDrafts.id, draftId));
}

export async function commitOnboardingDraft(id: string, owner: DraftOwner, database: Database = getDb()) {
  const key = requestKeySchema.safeParse(id);
  if (!key.success) throw new HttpError(400, "invalid_input", "Confira os dados enviados.", undefined, { fields: { id: "Identificador inválido." } });
  const draft = await loadDraft(key.data, database);
  if (draft.email !== owner.email.toLowerCase()) throw new HttpError(404, "not_found", "Cadastro não encontrado.");

  const [previous] = await database.select().from(onboardingRequests).where(and(
    eq(onboardingRequests.ownerId, owner.userId),
    eq(onboardingRequests.requestKey, key.data),
  )).limit(1);
  if (previous?.result) {
    await markConsumed(draft.id, previous.result.businessId, database);
    return { result: previous.result, replay: true as const };
  }
  if (draft.expiresAt.getTime() <= Date.now()) throw new HttpError(410, "draft_expired", "Seu cadastro guardado venceu.");

  if (oneBusinessPerOwner()) {
    const [owned] = await database.select({ slug: businesses.slug }).from(businesses).where(eq(businesses.ownerId, owner.userId)).orderBy(asc(businesses.createdAt), asc(businesses.id)).limit(1);
    if (owned) throw new HttpError(409, "already_has_business", "Você já tem uma página.", undefined, { publicPath: `/${owned.slug}` });
  }

  try {
    const { provisionBusiness } = await import("./service");
    const outcome = await provisionBusiness(owner.userId, key.data, draft.data, database);
    await markConsumed(draft.id, outcome.result.businessId, database);
    return outcome;
  } catch (error) {
    if (error instanceof HttpError && error.code === "slug_unavailable") {
      throw new HttpError(409, "slug_unavailable", error.message, undefined, {
        suggestions: await suggestFreeSlugs(draft.data.business.slug, draft.segment, database),
      });
    }
    throw error;
  }
}

export async function findActiveDraftByEmail(email: string, database: Database = getDb()) {
  const [draft] = await database.select().from(onboardingDrafts).where(and(
    eq(onboardingDrafts.email, email.trim().toLowerCase()),
    isNull(onboardingDrafts.consumedAt),
    sql`${onboardingDrafts.expiresAt} > now()`,
  )).orderBy(sql`${onboardingDrafts.updatedAt} desc`).limit(1);
  return draft ?? null;
}

export async function deleteExpiredOnboardingDrafts(database: Database = getDb()) {
  const removed = await database.delete(onboardingDrafts).where(lt(onboardingDrafts.expiresAt, new Date())).returning({ id: onboardingDrafts.id });
  return removed.length;
}
