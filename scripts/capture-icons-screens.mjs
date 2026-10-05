/**
 * Captura screenshots mobile/desktop das telas afetadas pelo enriquecimento de ícones.
 * Uso: node --import ./scripts/ts-register.mjs --env-file=.env scripts/capture-icons-screens.mjs before|after
 */
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { bookings, businesses, businessHours, customers, services, user } from "../db/schema";
import { getAuth } from "../lib/auth";

const PHASE = process.argv[2] === "after" ? "after" : "before";
const BASE = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3355";
const OUT = `/workspace/agendaPIX-screens/icons/${PHASE}`;
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

async function ensureUser(name, email) {
  const database = getDb();
  const [existing] = await database.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await database.insert(user).values({
    id: randomUUID(), name, email, emailVerified: true,
  }).returning();
  return created;
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function ensureBusiness(ownerId, name, slug, seedBooking = false) {
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
  await database.insert(businessHours).values(Array.from({ length: 7 }, (_, weekday) => ({
    businessId: created.id, weekday, opensAt: "08:00", closesAt: "20:00",
  })));
  const [customer] = await database.insert(customers).values({
    businessId: created.id, name: "Cliente E2E", phone: "+5511987654321",
  }).returning();
  if (seedBooking) {
    const today = todayInSaoPaulo();
    await database.insert(bookings).values({
      businessId: created.id, serviceId: service.id, customerId: customer.id,
      startsAt: new Date(`${today}T07:00:00-03:00`), endsAt: new Date(`${today}T07:30:00-03:00`),
      priceCents: 5000, depositCents: 1000, status: "confirmed",
    });
    await database.insert(bookings).values({
      businessId: created.id, serviceId: service.id, customerId: customer.id,
      startsAt: new Date(`${today}T08:00:00-03:00`), endsAt: new Date(`${today}T08:30:00-03:00`),
      priceCents: 5000, depositCents: 1000, status: "cancelled",
    });
  }
  return created;
}

async function mintCookie(email) {
  const capturePath = path.resolve("tests/e2e/.auth/magic-link-capture-icons.txt");
  await mkdir(path.dirname(capturePath), { recursive: true });
  process.env.MAGIC_LINK_CAPTURE_FILE = capturePath;
  try { await unlink(capturePath); } catch { /* ok */ }
  const auth = getAuth();
  const response = await auth.handler(new Request(`${BASE}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(BASE).origin },
    body: JSON.stringify({ email, callbackURL: `${BASE}/dashboard` }),
  }));
  if (!response.ok) throw new Error(`Falha ao pedir link mágico: ${response.status}`);
  const content = await readFile(capturePath, "utf8");
  const link = content.trim().split("\n").at(-1);
  if (!link?.startsWith("http")) throw new Error("Link mágico não capturado");
  const verified = await auth.handler(new Request(link));
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

async function hideNextPortal(page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.append(style);
    });
  });
}

async function shot(page, dir, name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${path.basename(path.dirname(dir))}/${path.basename(dir)}/${name}.png`);
}

async function latestPayment(slug) {
  const pool = getDb().$client;
  const { rows } = await pool.query(
    `select p.external_id, p.amount_cents from payments p join businesses b on b.id = p.business_id
     where b.slug = $1 order by p.created_at desc limit 1`,
    [slug],
  );
  return rows[0];
}

async function captureBooking(page, slug, dir) {
  await page.goto(`${BASE}/${slug}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, dir, "01-slug-servico");

  await page.getByRole("radiogroup", { name: /Serviços/ }).getByRole("radio").first().click();
  await page.getByRole("button", { name: /Escolher horário/ }).filter({ visible: true }).first().click();

  const slots = page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio");
  const days = page.getByTestId("day-option");
  await days.first().waitFor();
  const dayCount = await days.count();
  for (let i = 0; i < dayCount; i++) {
    if (await slots.first().waitFor({ state: "visible", timeout: 6000 }).then(() => true, () => false)) break;
    if (i + 1 < dayCount) await days.nth(i + 1).click();
  }
  await shot(page, dir, "02-slug-horario");

  await slots.first().click();
  await page.getByRole("button", { name: /Continuar com \d{2}:\d{2}/ }).filter({ visible: true }).first().click();
  await page.locator("#customer-name").waitFor();
  await page.locator("#customer-name").fill("Cliente Icons");
  await page.locator("#customer-phone").fill("11987654321");
  await page.locator("#customer-cpf").fill("52998224725");
  await shot(page, dir, "03-slug-dados-resumo");

  await page.getByRole("button", { name: /Gerar Pix/ }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: /Copiar código Pix/ }).waitFor({ timeout: 20000 });
  await shot(page, dir, "04-slug-pix");

  const payment = await latestPayment(slug);
  if (!payment) throw new Error("Pagamento não encontrado");
  const body = JSON.stringify({
    eventId: `evt-icons-${Date.now()}-${slug}`, type: "payment.paid",
    externalId: payment.external_id, amountCents: Number(payment.amount_cents),
    paidAt: new Date().toISOString(),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", process.env.FAKE_WEBHOOK_SECRET ?? "")
    .update(`${timestamp}.${body}`).digest("hex");
  const res = await page.request.post(`${BASE}/api/webhooks/payments/fake`, {
    headers: {
      "content-type": "application/json",
      "x-fake-timestamp": timestamp,
      "x-fake-signature": signature,
    },
    data: body,
  });
  if (res.status() !== 200) throw new Error(`Webhook falhou: ${res.status()}`);
  await page.getByRole("heading", { name: "Horário confirmado!" }).waitFor({ timeout: 20000 });
  await shot(page, dir, "05-slug-confirmado");
}

async function capturePainel(page, businessId, dir) {
  await page.goto(`${BASE}/dashboard?businessId=${businessId}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, dir, "06-painel-agenda-dia");

  await page.goto(`${BASE}/dashboard?businessId=${businessId}&view=week`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, dir, "07-painel-agenda-semana");

  await page.goto(`${BASE}/dashboard/services?businessId=${businessId}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, dir, "08-painel-servicos");

  await page.goto(`${BASE}/dashboard/customers?businessId=${businessId}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, dir, "09-painel-clientes");

  await page.goto(`${BASE}/dashboard/settings?businessId=${businessId}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, dir, "10-painel-configuracoes");
}

async function main() {
  console.log(`Capturando fase: ${PHASE} → ${OUT}`);
  await mkdir(path.join(OUT, "mobile"), { recursive: true });
  await mkdir(path.join(OUT, "desktop"), { recursive: true });

  const ownerEmail = `icons-owner-${randomUUID().slice(0, 8)}@example.com`;
  const foreignEmail = `icons-foreign-${randomUUID().slice(0, 8)}@example.com`;
  const owner = await ensureUser("Dono Icons", ownerEmail);
  const foreign = await ensureUser("Dono Estrangeiro", foreignEmail);
  const baseSlug = `icons-a-${owner.id.slice(0, 8)}`;
  const businessA = await ensureBusiness(owner.id, "Negócio Icons A", baseSlug, true);
  await ensureBusiness(foreign.id, "Negócio Icons B", `icons-b-${foreign.id.slice(0, 8)}`);
  const cookie = await mintCookie(ownerEmail);

  const browser = await chromium.launch();
  for (const [label, viewport] of Object.entries(VIEWPORTS)) {
    console.log(`→ ${label} ${viewport.width}x${viewport.height}`);
    const context = await browser.newContext({
      viewport,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      deviceScaleFactor: label === "mobile" ? 2 : 1,
    });
    await context.addCookies([{
      name: cookie.name, value: cookie.value,
      domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax",
    }]);
    const page = await context.newPage();
    await hideNextPortal(page);
    const dir = path.join(OUT, label);
    const bookingSlug = `${baseSlug}-${label}-${PHASE}`;
    const bookingBiz = await ensureBusiness(owner.id, `Negócio Icons ${label}`, bookingSlug, false);
    await captureBooking(page, bookingBiz.slug, dir);
    await capturePainel(page, businessA.id, dir);
    await context.close();
  }
  await browser.close();
  await getDb().$client.end();
  console.log(`Pronto: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
