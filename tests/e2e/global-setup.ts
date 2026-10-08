import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { chromium, type FullConfig } from "@playwright/test";
import { getDb } from "../../db";
import { bookings, businesses, businessHours, customers, services, user } from "../../db/schema";
import { getAuth } from "../../lib/auth";

const fixturePath = path.resolve("tests/e2e/.auth");
const ownerState = path.join(fixturePath, "owner.json");
const metaPath = path.join(fixturePath, "meta.json");
const capturePath = path.resolve("tests/e2e/.auth/magic-link.txt");

async function ensureUser(name: string, email: string) {
  const database = getDb();
  const [existing] = await database.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await database.insert(user).values({
    id: randomUUID(), name, email, emailVerified: true,
  }).returning();
  return created;
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function ensureBusiness(ownerId: string, name: string, slug: string, seedBooking = false) {
  const database = getDb();
  const [existing] = await database.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (existing) return existing;
  const [created] = await database.insert(businesses).values({
    ownerId, name, slug, timezone: "America/Sao_Paulo",
  }).returning();
  const [service] = await database.insert(services).values({
    businessId: created.id, name: "Corte E2E", durationMinutes: 30,
    priceCents: 5000, depositCents: 1000, active: true,
  }).returning();
  // Todos os dias abertos: a jornada de agendamento sempre encontra horário nos próximos dias.
  await database.insert(businessHours).values(Array.from({ length: 7 }, (_, weekday) => ({
    businessId: created.id, weekday, opensAt: "08:00", closesAt: "20:00",
  })));
  const [customer] = await database.insert(customers).values({
    businessId: created.id, name: "Cliente E2E", phone: "+5511987654321",
  }).returning();
  if (seedBooking) {
    // Reserva confirmada hoje às 07:00 (antes da abertura, não disputa horário com a jornada de agendamento).
    const today = todayInSaoPaulo();
    await database.insert(bookings).values({
      businessId: created.id, serviceId: service.id, customerId: customer.id,
      startsAt: new Date(`${today}T07:00:00-03:00`), endsAt: new Date(`${today}T07:30:00-03:00`),
      priceCents: 5000, depositCents: 1000, status: "confirmed",
    });
    // Cancelada no mesmo dia: o axe do painel cobre texto muted sem opacity empilhada.
    await database.insert(bookings).values({
      businessId: created.id, serviceId: service.id, customerId: customer.id,
      startsAt: new Date(`${today}T08:00:00-03:00`), endsAt: new Date(`${today}T08:30:00-03:00`),
      priceCents: 5000, depositCents: 1000, status: "cancelled",
    });
  }
  return created;
}

function magicLinkVerifyRequest(link: string, baseURL: string) {
  const source = new URL(link);
  if (source.pathname.endsWith("/magic-link/verify")) return new Request(source);
  const verify = new URL("/api/auth/magic-link/verify", baseURL);
  for (const key of ["token", "callbackURL", "errorCallbackURL", "newUserCallbackURL"]) {
    const value = source.searchParams.get(key);
    if (value) verify.searchParams.set(key, value);
  }
  if (!verify.searchParams.get("token")) throw new Error("Link de acesso sem código");
  return new Request(verify);
}

async function mintCookie(email: string) {
  process.env.MAGIC_LINK_CAPTURE_FILE = capturePath;
  try { await unlink(capturePath); } catch { /* ok */ }
  const auth = getAuth();
  const baseURL = process.env.BETTER_AUTH_URL!;
  const response = await auth.handler(new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(baseURL).origin },
    body: JSON.stringify({ email, callbackURL: `${baseURL}/dashboard` }),
  }));
  if (!response.ok) throw new Error(`Falha ao pedir link mágico: ${response.status}`);
  const content = await readFile(capturePath, "utf8");
  const link = content.trim().split("\n").at(-1);
  if (!link?.startsWith("http")) throw new Error("Link mágico não capturado");
  // O e-mail abre /entrar/confirmar. O handler do Better Auth só verifica em GET /magic-link/verify.
  const verified = await auth.handler(magicLinkVerifyRequest(link, baseURL));
  if (verified.status !== 302) throw new Error(`Verificação falhou: ${verified.status}`);
  const setCookie = verified.headers.getSetCookie?.() ?? [];
  const legacy = verified.headers.get("set-cookie");
  const cookies = setCookie.length ? setCookie : (legacy ? [legacy] : []);
  const sessionCookie = cookies.find((value) => value.includes("session_token"));
  if (!sessionCookie) throw new Error("Cookie de sessão ausente");
  const [pair] = sessionCookie.split(";");
  const eqIndex = pair.indexOf("=");
  return { name: pair.slice(0, eqIndex), value: pair.slice(eqIndex + 1) };
}

export default async function globalSetup(config: FullConfig) {
  await mkdir(fixturePath, { recursive: true });
  const ownerEmail = `e2e-owner-${randomUUID().slice(0, 8)}@example.com`;
  const foreignEmail = `e2e-foreign-${randomUUID().slice(0, 8)}@example.com`;
  const owner = await ensureUser("Dono E2E", ownerEmail);
  const foreign = await ensureUser("Dono Estrangeiro", foreignEmail);
  const businessA = await ensureBusiness(owner.id, "Negócio E2E A", `e2e-a-${owner.id.slice(0, 8)}`, true);
  const businessB = await ensureBusiness(foreign.id, "Negócio E2E B", `e2e-b-${foreign.id.slice(0, 8)}`);
  const cookie = await mintCookie(ownerEmail);

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: config.projects[0].use?.baseURL as string });
  await context.addCookies([{
    name: cookie.name,
    value: cookie.value,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await context.storageState({ path: ownerState });
  await browser.close();

  await writeFile(metaPath, JSON.stringify({
    ownerEmail, foreignEmail,
    businessAId: businessA.id, businessBId: businessB.id,
    businessASlug: businessA.slug, businessBSlug: businessB.slug,
    ownerName: owner.name,
  }, null, 2));

  await getDb().$client.end();
}
