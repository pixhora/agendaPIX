import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { POST as createDraft } from "../../app/api/onboarding/drafts/route";
import { GET as readDraft, PATCH as patchDraft } from "../../app/api/onboarding/drafts/[id]/route";
import { POST as commitDraft } from "../../app/api/onboarding/drafts/[id]/commit/route";
import { GET as slugAvailabilityRoute } from "../../app/api/public/slugs/availability/route";
import { getDb } from "../../db";
import { businesses, businessHours, onboardingDrafts, onboardingRequests, services, user, verification } from "../../db/schema";
import { commitOnboardingDraft, createOnboardingDraft, deleteExpiredOnboardingDrafts, signInOtpIdentifier } from "../../lib/onboarding/drafts";
import { draftBodyFromOnboarding, onboardingPlanForEnv, restoreOnboardingDraft } from "../../lib/onboarding/flow";

const db = getDb();
const owners: string[] = [];

function draftBody(email: string, slug: string, segment = "barbearia") {
  return {
    email,
    segment,
    plan: "base",
    data: {
      business: { name: "Studio Bella", slug },
      service: { name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 1000 },
      hours: [{ weekday: 1, opensAt: "09:00", closesAt: "18:00" }],
    },
  };
}

function originRequest(url: string, init: RequestInit & { ip?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", "http://localhost:3000");
  if (init.ip) headers.set("x-forwarded-for", init.ip);
  return new Request(url, { ...init, headers });
}

afterAll(async () => {
  if (owners.length) {
    await db.delete(onboardingRequests).where(inArray(onboardingRequests.ownerId, owners));
    await db.delete(onboardingDrafts).where(inArray(onboardingDrafts.email, owners.map((id) => `${id}@example.com`)));
    const rows = await db.select().from(businesses).where(inArray(businesses.ownerId, owners));
    for (const row of rows) {
      await db.delete(businessHours).where(eq(businessHours.businessId, row.id));
      await db.delete(services).where(eq(services.businessId, row.id));
    }
    await db.delete(businesses).where(inArray(businesses.ownerId, owners));
    await db.delete(user).where(inArray(user.id, owners));
  }
  await db.$client.end();
});

describe.sequential("rascunho de cadastro", () => {
  it("cria, publica e repete o mesmo resultado", async () => {
    const ownerId = randomUUID();
    owners.push(ownerId);
    const email = `${ownerId}@example.com`;
    await db.insert(user).values({ id: ownerId, name: "Dono", email, emailVerified: true });
    const created = await createOnboardingDraft(draftBody(email, `corte-${ownerId.slice(0, 8)}`), db);
    const first = await commitOnboardingDraft(created.draftId, { userId: ownerId, email }, db);
    const second = await commitOnboardingDraft(created.draftId, { userId: ownerId, email }, db);
    expect(first.replay).toBe(false);
    expect(second.replay).toBe(true);
    expect(second.result).toEqual(first.result);

    await db.update(onboardingDrafts).set({
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    }).where(eq(onboardingDrafts.id, created.draftId));
    const replay = await commitOnboardingDraft(created.draftId, { userId: ownerId, email }, db);
    expect(replay.replay).toBe(true);
    expect(replay.result.businessId).toBe(first.result.businessId);
  });

  it("exige cookie ou sessão para ler e recusa commit sem sessão", async () => {
    const ownerId = randomUUID();
    owners.push(ownerId);
    const email = `${ownerId}@example.com`;
    const ip = `203.0.113.${Number.parseInt(ownerId.slice(0, 2), 16) % 200 + 1}`;
    const response = await createDraft(originRequest("http://localhost:3000/api/onboarding/drafts", {
      method: "POST",
      ip,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draftBody(email, `salao-${ownerId.slice(0, 8)}`, "salao")),
    }));
    expect(response.status).toBe(201);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=604800");
    const { draftId } = await response.json() as { draftId: string };
    const hidden = await readDraft(new Request(`http://localhost:3000/api/onboarding/drafts/${draftId}`), { params: Promise.resolve({ id: draftId }) });
    expect(hidden.status).toBe(404);
    const visible = await readDraft(new Request(`http://localhost:3000/api/onboarding/drafts/${draftId}`, { headers: { cookie } }), { params: Promise.resolve({ id: draftId }) });
    expect(visible.status).toBe(200);
    const body = await visible.json() as { email: string | null };
    expect(body.email).toBe(`${ownerId.slice(0, 2)}••@example.com`);
    const denied = await commitDraft(originRequest(`http://localhost:3000/api/onboarding/drafts/${draftId}/commit`, { method: "POST" }), { params: Promise.resolve({ id: draftId }) });
    expect(denied.status).toBe(401);
    await db.delete(onboardingDrafts).where(eq(onboardingDrafts.id, draftId));
  });

  it("atualiza o e-mail e apaga o código anterior", async () => {
    const ownerId = randomUUID();
    owners.push(ownerId);
    const email = `${ownerId}@example.com`;
    const nextEmail = `novo-${ownerId}@example.com`;
    const created = await createOnboardingDraft(draftBody(email, `patch-${ownerId.slice(0, 8)}`), db);
    await db.insert(verification).values({
      id: randomUUID(),
      identifier: signInOtpIdentifier(email),
      value: "hash:0",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await patchDraft(new Request(`http://localhost:3000/api/onboarding/drafts/${created.draftId}`, {
      method: "PATCH",
      headers: { cookie: `onb_draft=${created.draftId}`, "content-type": "application/json" },
      body: JSON.stringify({ email: nextEmail }),
    }), { params: Promise.resolve({ id: created.draftId }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ email: "no••@example.com", draftId: created.draftId });
    expect(await db.select().from(verification).where(eq(verification.identifier, signInOtpIdentifier(email)))).toHaveLength(0);
    await db.delete(onboardingDrafts).where(eq(onboardingDrafts.id, created.draftId));
  });

  it("responde 410 quando o cadastro guardado venceu", async () => {
    const ownerId = randomUUID();
    owners.push(ownerId);
    const email = `${ownerId}@example.com`;
    const created = await createOnboardingDraft(draftBody(email, `vence-${ownerId.slice(0, 8)}`), db);
    await db.update(onboardingDrafts).set({
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 1000),
    }).where(eq(onboardingDrafts.id, created.draftId));
    const response = await readDraft(new Request(`http://localhost:3000/api/onboarding/drafts/${created.draftId}`, {
      headers: { cookie: `onb_draft=${created.draftId}` },
    }), { params: Promise.resolve({ id: created.draftId }) });
    expect(response.status).toBe(410);
    expect(await deleteExpiredOnboardingDrafts(db)).toBeGreaterThanOrEqual(1);
    const [gone] = await db.select().from(onboardingDrafts).where(eq(onboardingDrafts.id, created.draftId));
    expect(gone).toBeUndefined();
  });

  it("permite outro negócio e só trava com a flag ligada", async () => {
    const previous = process.env.ONE_BUSINESS_PER_OWNER;
    const ownerId = randomUUID();
    owners.push(ownerId);
    const email = `${ownerId}@example.com`;
    await db.insert(user).values({ id: ownerId, name: "Dono", email, emailVerified: true });
    try {
      delete process.env.ONE_BUSINESS_PER_OWNER;
      const first = await commitOnboardingDraft((await createOnboardingDraft(draftBody(email, `um-${ownerId.slice(0, 8)}`), db)).draftId, { userId: ownerId, email }, db);
      const second = await commitOnboardingDraft((await createOnboardingDraft(draftBody(email, `dois-${ownerId.slice(0, 8)}`), db)).draftId, { userId: ownerId, email }, db);
      expect(second.result.businessId).not.toBe(first.result.businessId);
      process.env.ONE_BUSINESS_PER_OWNER = "true";
      const blocked = commitOnboardingDraft((await createOnboardingDraft(draftBody(email, `tres-${ownerId.slice(0, 8)}`), db)).draftId, { userId: ownerId, email }, db);
      await expect(blocked).rejects.toMatchObject({ status: 409, code: "already_has_business", details: { publicPath: first.result.publicPath } });
    } finally {
      if (previous === undefined) delete process.env.ONE_BUSINESS_PER_OWNER;
      else process.env.ONE_BUSINESS_PER_OWNER = previous;
    }
  });

  it("sugere outro link quando o endereço já existe e marca reservado", async () => {
    const ownerId = randomUUID();
    owners.push(ownerId);
    const email = `${ownerId}@example.com`;
    const slug = `tomado-${ownerId.slice(0, 8)}`;
    await db.insert(user).values({ id: ownerId, name: "Dono", email, emailVerified: true });
    await commitOnboardingDraft((await createOnboardingDraft(draftBody(email, slug, "cilios"), db)).draftId, { userId: ownerId, email }, db);
    await expect(createOnboardingDraft(draftBody(`outro-${email}`, slug, "cilios"), db)).rejects.toMatchObject({ status: 409, code: "slug_unavailable" });
    const availability = await slugAvailabilityRoute(new Request(`http://localhost:3000/api/public/slugs/availability?slug=${slug}&segment=cilios&uf=sp`, {
      headers: { "x-forwarded-for": "203.0.113.40" },
    }));
    expect(availability.headers.get("cache-control")).toBe("no-store");
    const payload = await availability.json() as { available: boolean; reason: string; suggestions: string[] };
    expect(payload).toMatchObject({ available: false, reason: "taken" });
    expect(payload.suggestions).toHaveLength(3);
    expect(payload.suggestions).not.toContain(slug);
    expect(payload.suggestions[0]).toBe(`${slug}-lash`);
    const reserved = await slugAvailabilityRoute(new Request("http://localhost:3000/api/public/slugs/availability?slug=dashboard", {
      headers: { "x-forwarded-for": "203.0.113.41" },
    }));
    expect(await reserved.json()).toMatchObject({ valid: false, available: false, reason: "reserved" });
  });

  it("limita criações de rascunho por IP", async () => {
    const ip = "203.0.113.77";
    let lastStatus = 0;
    for (let index = 0; index < 11; index += 1) {
      const id = randomUUID();
      const response = await createDraft(originRequest("http://localhost:3000/api/onboarding/drafts", {
        method: "POST",
        ip,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draftBody(`${id}@example.com`, `limite-${id.slice(0, 8)}`)),
      }));
      lastStatus = response.status;
      if (response.status === 201) {
        const { draftId } = await response.json() as { draftId: string };
        await db.delete(onboardingDrafts).where(eq(onboardingDrafts.id, draftId));
      }
    }
    expect(lastStatus).toBe(429);
    await db.execute(sql`DELETE FROM abuse_rate_limits WHERE scope = 'onboarding-draft'`);
  });

  it("aceita em produção o passo 4 de ?plano=base mesmo com completo guardado e hora com segundos", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    const id = randomUUID();
    const email = `base-${id}@example.com`;
    try {
      const stored = {
        plan: "completo" as const,
        businessName: "Studio Repro",
        slug: `repro-${id.slice(0, 8)}`,
        serviceName: "Corte",
        durationMinutes: 45,
        priceCents: 5000,
        depositCents: 0,
        depositMode: "30" as const,
        openDays: [1, 2, 3, 4, 5, 6],
        opensAt: "09:00:00",
        closesAt: "19:00:00",
        email,
      };
      const body = draftBodyFromOnboarding(restoreOnboardingDraft(stored, onboardingPlanForEnv("base", "production")));
      const response = await createDraft(originRequest("http://localhost:3000/api/onboarding/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }));
      const payload = await response.json() as { draftId?: string; error?: { code?: string } };
      expect(response.status).toBe(201);
      const draftId = payload.draftId ?? "";
      const [row] = await db.select().from(onboardingDrafts).where(eq(onboardingDrafts.id, draftId));
      expect(row?.plan).toBe("base");
      expect(row?.data.hours[0]).toEqual({ weekday: 1, opensAt: "09:00", closesAt: "19:00" });
      await db.delete(onboardingDrafts).where(eq(onboardingDrafts.id, draftId));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
