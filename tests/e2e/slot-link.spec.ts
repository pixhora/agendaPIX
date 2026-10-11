import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { expect, type Page } from "@playwright/test";
import { tenantScopedHash } from "../../lib/bookings/rate-limit";
import { expectNoAxeViolations, ownerStorageState, readMeta, test } from "./helpers";

const meta = readMeta();
const shots = "/opt/cursor/artifacts/slot-link";

test.use({ storageState: ownerStorageState });

test.beforeEach(async () => {
  await withPool((pool) => pool.query("truncate booking_rate_limits, abuse_rate_limits"));
});

function saoPauloDay(offset: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + offset));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function localTime(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("hour")}:${read("minute")}`;
}

async function withPool<T>(fn: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function paymentCount(slug: string) {
  return withPool(async (pool) => {
    const { rows } = await pool.query<{ count: string }>(
      "select count(*)::text as count from payments p join businesses b on b.id = p.business_id where b.slug = $1",
      [slug],
    );
    return Number(rows[0]?.count ?? 0);
  });
}

async function serviceId(page: Page) {
  const response = await page.request.get(`/api/public/${meta.businessASlug}/services`);
  const body = await response.json() as { services: { id: string; depositCents: number; name: string }[] };
  const service = body.services.find((item) => item.depositCents > 0);
  if (!service) throw new Error("Serviço com sinal ausente");
  return service;
}

async function freeSlot(page: Page, id: string, date: string) {
  const response = await page.request.get(`/api/public/${meta.businessASlug}/availability?serviceId=${id}&date=${date}`);
  const body = await response.json() as { slots?: { startsAt: string }[] };
  const slot = body.slots?.[body.slots.length - 1];
  if (!slot) throw new Error(`Sem horário livre em ${date}`);
  return { startsAt: slot.startsAt, time: localTime(slot.startsAt), date };
}

async function occupySlot(linkId: string, priceCents: number, depositCents: number) {
  await withPool(async (pool) => {
    const link = await pool.query<{ starts_at: Date; ends_at: Date; service_id: string }>(
      "select starts_at, ends_at, service_id from slot_links where id = $1",
      [linkId],
    );
    const row = link.rows[0];
    if (!row) throw new Error("link ausente");
    const phone = `+55119${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    const customer = await pool.query<{ id: string }>(
      "insert into customers (business_id, name, phone) values ($1, 'Outra cliente', $2) returning id",
      [meta.businessAId, phone],
    );
    await pool.query(
      `insert into bookings (business_id, service_id, customer_id, request_key, starts_at, ends_at, price_cents, deposit_cents, status)
       values ($1, $2, $3, gen_random_uuid(), $4, $5, $6, $7, 'confirmed')`,
      [meta.businessAId, row.service_id, customer.rows[0]?.id, row.starts_at, row.ends_at, priceCents, depositCents],
    );
  });
}

async function fillCreateLimit() {
  const owner = await withPool(async (pool) => {
    const { rows } = await pool.query<{ owner_id: string }>("select owner_id from businesses where id = $1", [meta.businessAId]);
    return rows[0]?.owner_id ?? "";
  });
  if (!owner) throw new Error("dono ausente");
  const hash = tenantScopedHash("slot-link-create:v1", meta.businessAId, owner);
  await withPool((pool) => pool.query(
    `insert into booking_rate_limits (business_id, client_hash, attempts, window_started_at)
     values ($1, $2, 1000, now())
     on conflict (business_id, client_hash)
     do update set attempts = 1000, window_started_at = now()`,
    [meta.businessAId, hash],
  ));
  return hash;
}

async function clearCreateLimit(hash: string) {
  await withPool((pool) => pool.query(
    "delete from booking_rate_limits where business_id = $1 and client_hash = $2",
    [meta.businessAId, hash],
  ));
}

async function createLink(page: Page, service: string, date: string, time: string, customerLabel?: string) {
  await page.goto(`/dashboard?businessId=${meta.businessAId}`);
  return page.evaluate(async ({ businessId, serviceId: id, date: day, time: hour, customerLabel: label }) => {
    const response = await fetch(`/api/businesses/${businessId}/slot-links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceId: id, date: day, time: hour, ...(label ? { customerLabel: label } : {}) }),
    });
    return { status: response.status, body: await response.json() };
  }, { businessId: meta.businessAId, serviceId: service, date, time, customerLabel: customerLabel ?? "" });
}

const frames = [
  { name: "360", width: 360, height: 780 },
  { name: "390", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function submitDeposit(page: Page, phone: string) {
  await page.getByLabel("Li e concordo com a política").check();
  await page.getByLabel("Nome").fill("Ana Souza");
  await page.getByLabel("WhatsApp").fill(phone);
  const cpf = page.getByLabel("CPF");
  if (await cpf.isVisible()) await cpf.fill("529.982.247-25");
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && response.url().includes("/slot-links/")
    && response.url().endsWith("/pay")
  ));
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  return responsePromise;
}

async function payLocked(page: Page) {
  await page.getByLabel("Li e concordo com a política").check();
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && response.url().includes("/slot-links/")
    && response.url().endsWith("/pay")
  ));
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  return responsePromise;
}

async function replaceStoredPayKey(page: Page, idempotencyKey: string) {
  await page.evaluate((nextKey) => {
    const prefix = "agendapix.slot-link.pay.";
    const rewrite = (storage: Storage) => {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(prefix)) continue;
        const data = JSON.parse(storage.getItem(key) ?? "{}") as { idempotencyKey?: string };
        data.idempotencyKey = nextKey;
        storage.setItem(key, JSON.stringify(data));
      }
    };
    rewrite(sessionStorage);
    rewrite(localStorage);
  }, idempotencyKey);
}

async function shoot(page: Page, name: string) {
  await mkdir(shots, { recursive: true });
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
}

/** Prints do mesmo estado em 360, 390 e desktop, claro e escuro. Não navega de novo. */
async function shootMatrix(page: Page, name: string) {
  const original = page.viewportSize();
  await mkdir(shots, { recursive: true });
  for (const frame of frames) {
    for (const scheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width: frame.width, height: frame.height });
      await page.emulateMedia({ colorScheme: scheme });
      await page.evaluate((theme) => {
        let style = document.getElementById("shot-freeze");
        if (!style) {
          style = document.createElement("style");
          style.id = "shot-freeze";
          style.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}";
          document.head.appendChild(style);
        }
        const dark = theme === "dark";
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.classList.toggle("light", !dark);
        document.documentElement.style.colorScheme = theme;
        try { localStorage.setItem("agenda-theme", theme); } catch { /* print segue com a classe */ }
      }, scheme);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
      const label = scheme === "dark" ? "escuro" : "claro";
      await page.screenshot({ path: path.join(shots, `${name}-${frame.name}-${label}.png`), fullPage: true });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  });
  if (original) await page.setViewportSize(original);
}

test("gerar o link não reserva: a página normal ocupa e o link avisa sem criar Pix", async ({ page }, testInfo) => {
  const service = await serviceId(page);
  const slot = await freeSlot(page, service.id, saoPauloDay(2));
  const before = await paymentCount(meta.businessASlug);
  const created = await createLink(page, service.id, slot.date, slot.time);
  expect(created.status).toBe(201);
  expect(await paymentCount(meta.businessASlug)).toBe(before);
  const token = created.body.token as string;
  const previewId = created.body.previewId as string;

  await page.goto(`/${meta.businessASlug}`);
  await page.getByRole("radiogroup", { name: /Serviços/ }).getByRole("radio", { name: new RegExp(service.name) }).click();
  await page.getByRole("button", { name: /Escolher horário/ }).filter({ visible: true }).first().click();
  const long = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${slot.date}T12:00:00Z`));
  await page.getByRole("button", { name: new RegExp(long, "i") }).click();
  await page.getByRole("radiogroup", { name: "Horários disponíveis" }).getByRole("radio", { name: slot.time, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`Continuar com ${slot.time}`) }).filter({ visible: true }).first().click();
  await page.locator("#customer-name").fill(`Cliente Link ${testInfo.project.name}`);
  await page.locator("#customer-phone").fill(testInfo.project.name === "desktop" ? "11987651002" : "11987651001");
  const cpf = page.locator("#customer-cpf");
  if (await cpf.isVisible()) await cpf.fill("52998224725");
  await page.getByRole("button", { name: /Gerar Pix de/ }).filter({ visible: true }).first().click();
  await expect(page.getByRole("button", { name: /Copiar código/ })).toBeVisible({ timeout: 20_000 });
  const afterBooking = await paymentCount(meta.businessASlug);

  const response = await page.goto(`/${meta.businessASlug}/h/${token}`);
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  // O proxy manda no-store. O next dev troca esse valor por no-cache, must-revalidate na hora de servir o HTML.
  expect(response?.headers()["cache-control"] ?? "").toMatch(/no-store|no-cache/);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Esse horário acabou de ser reservado." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copiar código/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver horários disponíveis" })).toHaveAttribute("href", `/${meta.businessASlug}`);
  expect(await paymentCount(meta.businessASlug)).toBe(afterBooking);
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toMatch(/noindex/);
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImage ?? "").not.toContain(token);
  expect(ogImage ?? "").toContain(previewId);
  if (testInfo.project.name === "desktop") await shoot(page, "cliente-ocupado");
});

test("caminho feliz até a tela de Pix, com rodapé fora do pagamento", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto(`/${meta.businessASlug}`);
  await expect(page.getByRole("link", { name: "Crie a sua grátis" })).toHaveAttribute("href", "/?utm_source=agendapix&utm_medium=rodape&utm_campaign=pagina_publica");

  const service = await serviceId(page);
  const slot = await freeSlot(page, service.id, saoPauloDay(3));
  const created = await createLink(page, service.id, slot.date, slot.time);
  expect(created.status).toBe(201);
  await page.goto(`/${meta.businessASlug}/h/${created.body.token}`);
  await expect(page.getByRole("heading", { level: 1, name: "Negócio E2E A" })).toBeVisible();
  await expect(page.getByLabel("Nome")).toHaveValue("");
  await expect(page.getByLabel("WhatsApp")).toHaveValue("");
  await expect(page.getByText(/Sinal agora:/)).toBeVisible();
  if (testInfo.project.name === "desktop") await shootMatrix(page, "cliente-formulario");
  await page.getByLabel("Li e concordo com a política").check();
  await page.getByLabel("Nome").fill("Ana Souza");
  await page.getByLabel("WhatsApp").fill(testInfo.project.name === "desktop" ? "11987652002" : "11987652001");
  const cpf = page.getByLabel("CPF");
  if (await cpf.isVisible()) await cpf.fill("529.982.247-25");
  await withPool((pool) => pool.query(
    "update bookings set status = 'expired' where business_id = $1 and status = 'pending_payment'",
    [meta.businessAId],
  ));
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  await expect(page.getByRole("button", { name: /Copiar código/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("slot-link-payer")).toContainText("Ana Souza");
  await expect(page.getByLabel("Nome")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Crie a sua grátis" })).toHaveCount(0);
  if (testInfo.project.name === "desktop") await shootMatrix(page, "cliente-pix");
});

test("retomada com o prazo do link vencido devolve o mesmo Pix", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const phone = testInfo.project.name === "desktop" ? "11987653002" : "11987653001";
  const service = await serviceId(page);
  const slot = await freeSlot(page, service.id, saoPauloDay(7));
  const created = await createLink(page, service.id, slot.date, slot.time);
  expect(created.status).toBe(201);
  const token = created.body.token as string;

  await page.goto(`/${meta.businessASlug}/h/${token}`);
  await expect(page.getByLabel("Nome")).toHaveValue("");
  await withPool((pool) => pool.query(
    "update bookings set status = 'expired' where business_id = $1 and status = 'pending_payment'",
    [meta.businessAId],
  ));
  const first = await submitDeposit(page, phone);
  expect(first.status()).toBe(201);
  const firstBody = await first.json() as { payment?: { copyPaste?: string | null } };
  const copyPaste = firstBody.payment?.copyPaste ?? "";
  expect(copyPaste.length).toBeGreaterThan(10);
  const firstKey = first.request().headers()["idempotency-key"];
  const firstPayload = first.request().postData();
  expect(firstKey).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  await expect(page.getByTestId("pix-copypaste")).toHaveValue(copyPaste);
  await expect(page.getByTestId("slot-link-payer")).toContainText("Ana Souza");
  await expect(page.getByLabel("Nome")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Este link expirou." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Este horário já foi confirmado." })).toHaveCount(0);

  await withPool((pool) => pool.query(
    "update slot_links set created_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute' where id = $1",
    [created.body.id],
  ));
  await page.goto(`/${meta.businessASlug}/h/${token}`);
  await expect(page.getByTestId("slot-link-payer")).toContainText("Ana Souza");
  await expect(page.getByLabel("Nome")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Este link expirou." })).toHaveCount(0);

  const resumed = await payLocked(page);
  expect(resumed.status()).toBe(201);
  const resumedBody = await resumed.json() as { payment?: { copyPaste?: string | null; id?: string } };
  expect(resumed.request().headers()["idempotency-key"]).toBe(firstKey);
  expect(resumed.request().postData()).toBe(firstPayload);
  expect(resumedBody.payment?.copyPaste).toBe(copyPaste);
  await expect(page.getByTestId("pix-copypaste")).toHaveValue(copyPaste);
  await expect(page.getByRole("heading", { name: "Este link expirou." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Este horário já foi confirmado." })).toHaveCount(0);

  const otherKey = "22222222-2222-4222-8222-222222222222";
  expect(otherKey).not.toBe(firstKey);
  await replaceStoredPayKey(page, otherKey);
  await page.goto(`/${meta.businessASlug}/h/${token}`);
  await expect(page.getByTestId("slot-link-payer")).toContainText("Ana Souza");
  await expect(page.getByRole("heading", { name: "Este link expirou." })).toHaveCount(0);
  const refused = await payLocked(page);
  expect(refused.status()).toBe(410);
  expect(refused.request().headers()["idempotency-key"]).toBe(otherKey);
  const refusedBody = await refused.json() as { error?: { code?: string } };
  expect(refusedBody.error?.code).toBe("link_expired");
  await expect(page.getByRole("heading", { name: "Este link expirou." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pagar sinal/ })).toHaveCount(0);
  await expect(page.getByTestId("pix-copypaste")).toHaveCount(0);
});

test("mesma chave com outros dados oferece continuar o pagamento", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const phone = testInfo.project.name === "desktop" ? "11987654002" : "11987654001";
  const service = await serviceId(page);
  const slot = await freeSlot(page, service.id, saoPauloDay(8));
  const created = await createLink(page, service.id, slot.date, slot.time);
  expect(created.status).toBe(201);
  const token = created.body.token as string;
  const bodies: string[] = [];
  let hits = 0;
  await page.route(`**/api/public/${meta.businessASlug}/slot-links/${token}/pay`, async (route) => {
    hits += 1;
    bodies.push(route.request().postData() ?? "");
    if (hits === 1) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "idempotency_conflict",
            message: "Essa chave já foi usada em outro agendamento.",
            customerPhone: "+5511900000000",
          },
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto(`/${meta.businessASlug}/h/${token}`);
  await withPool((pool) => pool.query(
    "update bookings set status = 'expired' where business_id = $1 and status = 'pending_payment'",
    [meta.businessAId],
  ));
  const refused = await submitDeposit(page, phone);
  expect(refused.status()).toBe(409);
  await expect(page.getByRole("heading", { name: "Você já começou o pagamento deste horário com outros dados." })).toBeVisible();
  await expect(page.getByText("Para corrigir nome ou WhatsApp, fale com a loja depois de pagar.")).toBeVisible();
  const resume = page.getByRole("button", { name: "Continuar pagamento" });
  await expect(resume).toBeEnabled();
  await expect(resume).toHaveClass(/bg-pix-deep/);
  await expect(resume).toHaveClass(/text-slab-foreground/);
  const otherSlots = page.getByRole("link", { name: "Ver horários disponíveis" });
  await expect(otherSlots).toHaveAttribute("href", `/${meta.businessASlug}`);
  await expect(otherSlots).toHaveClass(/border/);
  await expect(otherSlots).toHaveClass(/text-ink/);
  await expect(page.getByText("+5511900000000")).toHaveCount(0);
  await expect(page.getByText(/já foi usada/)).toHaveCount(0);
  await expect(page.getByLabel("Nome")).toHaveCount(0);
  if (testInfo.project.name === "desktop") await shootMatrix(page, "cliente-outros-dados");
  const continued = page.waitForResponse((response) => (
    response.request().method() === "POST" && response.url().endsWith("/pay")
  ));
  await page.getByRole("button", { name: "Continuar pagamento" }).click();
  const resumed = await continued;
  expect(resumed.status()).toBe(201);
  expect(bodies[0]).toBe(bodies[1]);
  expect(bodies[0]).toContain("Ana Souza");
  await expect(page.getByRole("button", { name: /Copiar código/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("slot-link-payer")).toContainText("Ana Souza");
  await expect(page.getByLabel("Nome")).toHaveCount(0);
});

test("link expirado e link cancelado", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const service = await serviceId(page);
  const expiredSlot = await freeSlot(page, service.id, saoPauloDay(4));
  const expired = await createLink(page, service.id, expiredSlot.date, expiredSlot.time);
  expect(expired.status).toBe(201);
  await withPool((pool) => pool.query(
    "update slot_links set created_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute' where id = $1",
    [expired.body.id],
  ));
  await page.goto(`/${meta.businessASlug}/h/${expired.body.token}`);
  await expect(page.getByLabel("Nome")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Este link expirou." })).toHaveCount(0);
  const expiredPay = await submitDeposit(page, testInfo.project.name === "desktop" ? "11987656002" : "11987656001");
  expect(expiredPay.status()).toBe(410);
  expect((await expiredPay.json() as { error?: { code?: string } }).error?.code).toBe("link_expired");
  await expect(page.getByRole("heading", { name: "Este link expirou." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver horários disponíveis" })).toBeVisible();
  if (testInfo.project.name === "desktop") await shootMatrix(page, "cliente-expirado");

  const cancelledSlot = await freeSlot(page, service.id, saoPauloDay(5));
  const cancelled = await createLink(page, service.id, cancelledSlot.date, cancelledSlot.time);
  expect(cancelled.status).toBe(201);
  const cancelResponse = await page.evaluate(async ({ businessId, linkId }) => {
    const response = await fetch(`/api/businesses/${businessId}/slot-links/${linkId}/cancel`, { method: "POST" });
    return response.status;
  }, { businessId: meta.businessAId, linkId: cancelled.body.id });
  expect(cancelResponse).toBe(200);
  await page.goto(`/${meta.businessASlug}/h/${cancelled.body.token}`);
  await expect(page.getByRole("heading", { name: "Este link não está mais disponível." })).toBeVisible();
  if (testInfo.project.name === "desktop") await shoot(page, "cliente-cancelado");

  const bogus = "c".repeat(43);
  await page.goto(`/${meta.businessASlug}/h/${bogus}`);
  await expect(page.getByRole("heading", { name: "Este link não está mais disponível." })).toBeVisible();
  if (testInfo.project.name === "desktop") await shoot(page, "cliente-invalido");

  const paidSlot = await freeSlot(page, service.id, saoPauloDay(1));
  const paid = await createLink(page, service.id, paidSlot.date, paidSlot.time);
  expect(paid.status).toBe(201);
  await withPool((pool) => pool.query(
    `update slot_links
        set status = 'paid',
            booking_id = (
              select b.id from bookings b
              where b.business_id = $2
                and not exists (select 1 from slot_links s where s.booking_id = b.id)
              limit 1
            )
      where id = $1
      returning booking_id`,
    [paid.body.id, meta.businessAId],
  ));
  await page.goto(`/${meta.businessASlug}/h/${paid.body.token}`);
  await expect(page.getByRole("heading", { name: "Este horário já foi confirmado." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pagar sinal/ })).toHaveCount(0);
  if (testInfo.project.name === "desktop") await shootMatrix(page, "cliente-pago");
});

test("dono gera o link na agenda e a prévia do horário responde imagem", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== "desktop", "prints e axe ficam no desktop, com os dois tamanhos");
  await page.goto(`/dashboard?businessId=${meta.businessAId}`);
  await page.getByRole("button", { name: "Link de horário" }).click();
  await expect(page.getByRole("heading", { name: "Mandar um horário" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Serviço" })).toHaveValue("");
  await shoot(page, "dono-sheet-vazio");

  await page.getByLabel("Serviço").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Data", exact: true }).click();
  const day = page.locator("dialog button:not([disabled])").filter({ hasText: /^\d{1,2}$/ });
  await expect(day.first()).toBeVisible();
  await day.first().click();
  await page.locator("dialog").getByRole("radiogroup", { name: "Horário" }).getByRole("radio").first().click();
  await expect(page.getByText("O horário só fica reservado quando a cliente pagar o sinal.")).toBeVisible();
  await shoot(page, "dono-sheet");
  await page.getByRole("button", { name: "Gerar link" }).click();
  await expect(page.getByRole("heading", { name: "Link pronto" })).toBeVisible();
  await expect(page.getByText(/Vale até .+ ou até alguém ocupar o horário/)).toBeVisible();
  await shootMatrix(page, "dono-link-pronto");
  await page.getByRole("button", { name: "Fechar" }).click();
  const sentDay = await withPool(async (pool) => {
    const { rows } = await pool.query<{ day: string }>(
      "select to_char(starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as day from slot_links where business_id = $1 order by created_at desc limit 1",
      [meta.businessAId],
    );
    return rows[0]?.day;
  });
  await page.goto(`/dashboard?businessId=${meta.businessAId}&date=${sentDay}`);
  await expect(page.getByRole("heading", { name: "Links enviados" })).toBeVisible();
  await expect(page.getByText("Aguardando pagamento").first()).toBeVisible();
  await shootMatrix(page, "dono-lista");

  const imageUrl = await page.locator('meta[property="og:image"]').count();
  void imageUrl;
  const service = await serviceId(page);
  const slot = await freeSlot(page, service.id, saoPauloDay(6));
  const created = await createLink(page, service.id, slot.date, slot.time);
  expect(created.status).toBe(201);
  const previewId = created.body.previewId as string;
  const image = await page.request.get(`/og/slot-link/${previewId}`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect(image.headers()["x-robots-tag"]).toContain("noindex");
  await mkdir(shots, { recursive: true });
  await writeFile(path.join(shots, "og-horario.png"), await image.body());

  await page.goto(`/${meta.businessASlug}/h/${created.body.token}`);
  for (const width of [360, 390, 1440]) {
    for (const scheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Negócio E2E A" })).toBeVisible();
      await expectNoAxeViolations(page, `link do horário ${width} ${scheme}`);
    }
  }

  await page.route(`**/api/public/${meta.businessASlug}/slot-links/**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = route.request().url();
    if (url.endsWith("/offline")) return route.abort("internetdisconnected");
    return route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "mp_not_connected", message: "interno", customerPhone: "+5511900000000" } }),
    });
  });
  await page.goto(`/${meta.businessASlug}/h/${"d".repeat(43)}`);
  await expect(page.getByRole("heading", { name: /não está recebendo sinal/ })).toBeVisible();
  await expect(page.getByText("+5511900000000")).toHaveCount(0);
  await shoot(page, "cliente-sem-mp");

  await page.unroute(`**/api/public/${meta.businessASlug}/slot-links/**`);
  await page.route(`**/api/public/${meta.businessASlug}/slot-links/**`, (route) => route.abort("internetdisconnected"));
  await page.goto(`/${meta.businessASlug}/h/${"e".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "Sem conexão. Verifique sua internet e tente de novo." })).toBeVisible();
  await shoot(page, "cliente-sem-conexao");

  await page.unroute(`**/api/public/${meta.businessASlug}/slot-links/**`);
  await page.route(`**/api/public/${meta.businessASlug}/slot-links/**`, (route) => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "link_in_progress", message: "interno" } }),
  }));
  await page.goto(`/${meta.businessASlug}/h/${"f".repeat(43)}`);
  await expect(page.getByRole("heading", { name: /Alguém está pagando este horário agora/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await shootMatrix(page, "cliente-em-pagamento");
});

test("gerar novo link na rota real substitui, recusa e a cliente pede o link novo", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const service = await serviceId(page);
  const dayFor = (offset: number) => saoPauloDay(testInfo.project.name === "desktop" ? offset + 20 : offset);
  const slot = await freeSlot(page, service.id, dayFor(9));
  const label = `Reemitir ${testInfo.project.name}`;
  const created = await createLink(page, service.id, slot.date, slot.time, label);
  expect(created.status).toBe(201);
  const linkId = created.body.id as string;
  await page.goto(`/dashboard?businessId=${meta.businessAId}&date=${slot.date}`);
  await expect(page.getByRole("heading", { name: "Links enviados" })).toBeVisible();
  const row = page.getByTestId("sent-links").getByRole("listitem").filter({ hasText: label });
  await expect(row.getByRole("button", { name: "Copiar link" })).toHaveCount(0);
  await row.getByRole("button", { name: "Gerar novo link" }).click();
  const dialog = page.getByRole("dialog", { name: "Gerar um novo link?" });
  await expect(dialog.getByText("O link que você já enviou para este horário vai parar de funcionar. Envie o novo para a cliente.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeVisible();
  if (testInfo.project.name === "desktop") await shootMatrix(page, "dono-reemitir-confirma");

  const reissueResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes(`/slot-links/${linkId}/reissue`));
  await dialog.getByRole("button", { name: "Gerar novo link" }).click();
  expect((await reissueResponse).status()).toBe(201);
  const ready = page.getByRole("dialog", { name: "Link pronto" });
  await expect(ready.getByRole("heading", { name: "Link pronto" })).toBeVisible();
  await expect(ready.getByTestId("slot-link-ready").getByRole("button", { name: "Copiar link", exact: true })).toBeVisible();
  await expect(ready.getByRole("button", { name: "Enviar no WhatsApp" })).toBeVisible();
  if (testInfo.project.name === "desktop") await shootMatrix(page, "dono-reemitir-pronto");
  await ready.getByRole("button", { name: "Fechar" }).click();
  const list = page.getByTestId("sent-links");
  const first = list.getByRole("listitem").first();
  await expect(first).toContainText("Aguardando pagamento");
  await expect(first).toContainText(label);
  await expect(first.getByRole("button", { name: "Gerar novo link" })).toBeVisible();
  const replaced = list.getByRole("listitem").filter({ hasText: "Substituído" });
  await expect(replaced).toHaveCount(1);
  await expect(replaced.getByRole("button", { name: "Gerar novo link" })).toHaveCount(0);
  await expect(replaced.getByRole("button", { name: "Cancelar link" })).toHaveCount(0);
  await expect(list).not.toContainText(created.body.token as string);
  if (testInfo.project.name === "desktop") await shootMatrix(page, "dono-reemitir-lista");

  await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
  await page.getByRole("textbox", { name: "WhatsApp do negócio" }).fill("+5511988887777");
  await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
  await expect(page.getByRole("status").filter({ hasText: "WhatsApp salvo." })).toBeVisible();
  const listed = await page.request.get(`/api/public/${meta.businessASlug}/services`);
  const store = await listed.json() as { name: string; contactWhatsapp: string | null };
  expect(store.contactWhatsapp).toBe("+5511988887777");
  const updated = `Este link foi atualizado. Peça o link novo para ${store.name}.`;
  try {
    await page.goto(`/${meta.businessASlug}/h/${created.body.token}`);
    await expect(page.getByRole("heading", { name: updated })).toBeVisible();
    const talk = page.getByRole("link", { name: "Falar com a loja" });
    await expect(talk).toHaveAttribute("href", "https://wa.me/5511988887777");
    await expect(talk).toHaveClass(/bg-pix/);
    const slotsLink = page.getByRole("link", { name: "Ver horários disponíveis" });
    await expect(slotsLink).toHaveAttribute("href", `/${meta.businessASlug}`);
    await expect(slotsLink).toHaveClass(/border/);
    await expect(page.getByText("interno")).toHaveCount(0);
    if (testInfo.project.name === "desktop") await shootMatrix(page, "cliente-link-atualizado");
  } finally {
    await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
    await page.getByRole("textbox", { name: "WhatsApp do negócio" }).fill("");
    await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
    await expect(page.getByRole("status").filter({ hasText: "WhatsApp salvo." })).toBeVisible();
  }

  const payingSlot = await freeSlot(page, service.id, dayFor(10));
  const paying = await createLink(page, service.id, payingSlot.date, payingSlot.time, `Pagando ${testInfo.project.name}`);
  expect(paying.status).toBe(201);
  await page.goto(`/${meta.businessASlug}/h/${paying.body.token}`);
  const paid = await submitDeposit(page, testInfo.project.name === "desktop" ? "11987657002" : "11987657001");
  expect(paid.status()).toBe(201);
  await page.goto(`/dashboard?businessId=${meta.businessAId}&date=${payingSlot.date}`);
  const payingRow = page.getByTestId("sent-links").getByRole("listitem").filter({ hasText: `Pagando ${testInfo.project.name}` });
  await payingRow.getByRole("button", { name: "Gerar novo link" }).click();
  const payingDialog = page.getByRole("dialog", { name: "Gerar um novo link?" });
  const blocked = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/reissue"));
  await payingDialog.getByRole("button", { name: "Gerar novo link" }).click();
  expect((await blocked).status()).toBe(409);
  await expect(payingDialog.getByText("A cliente está pagando este horário agora. Espere alguns minutos antes de gerar outro link.")).toBeVisible();
  if (testInfo.project.name === "desktop") await shootMatrix(page, "dono-reemitir-pagando");
  await payingDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(payingRow).toContainText("Aguardando pagamento");
  await expect(payingRow.getByRole("button", { name: "Gerar novo link" })).toBeVisible();

  const takenSlot = await freeSlot(page, service.id, dayFor(11));
  const taken = await createLink(page, service.id, takenSlot.date, takenSlot.time, `Ocupado ${testInfo.project.name}`);
  expect(taken.status).toBe(201);
  const takenService = taken.body.service as { priceCents: number; depositCents: number };
  await page.goto(`/dashboard?businessId=${meta.businessAId}&date=${takenSlot.date}`);
  const takenRow = page.getByTestId("sent-links").getByRole("listitem").filter({ hasText: `Ocupado ${testInfo.project.name}` });
  await takenRow.getByRole("button", { name: "Gerar novo link" }).click();
  const takenDialog = page.getByRole("dialog", { name: "Gerar um novo link?" });
  // A listagem recalcula o status e esconde o botão. A ocupação entra com a confirmação já aberta.
  await occupySlot(taken.body.id as string, takenService.priceCents, takenService.depositCents);
  const unavailable = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/reissue"));
  await takenDialog.getByRole("button", { name: "Gerar novo link" }).click();
  expect((await unavailable).status()).toBe(409);
  await expect(takenDialog.getByText("Este horário já foi ocupado. O link antigo continua na lista, mas não dá pra gerar outro para ele.")).toBeVisible();
  if (testInfo.project.name === "desktop") await shootMatrix(page, "dono-reemitir-ocupado");
  await takenDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(takenRow).toContainText("Aguardando pagamento");

  const limitedSlot = await freeSlot(page, service.id, dayFor(12));
  const limited = await createLink(page, service.id, limitedSlot.date, limitedSlot.time, `Limite ${testInfo.project.name}`);
  expect(limited.status).toBe(201);
  const limitHash = await fillCreateLimit();
  try {
    await page.goto(`/dashboard?businessId=${meta.businessAId}&date=${limitedSlot.date}`);
    const limitedRow = page.getByTestId("sent-links").getByRole("listitem").filter({ hasText: `Limite ${testInfo.project.name}` });
    await limitedRow.getByRole("button", { name: "Gerar novo link" }).click();
    const limitedDialog = page.getByRole("dialog", { name: "Gerar um novo link?" });
    const limitedResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/reissue"));
    await limitedDialog.getByRole("button", { name: "Gerar novo link" }).click();
    expect((await limitedResponse).status()).toBe(429);
    await expect(limitedDialog.getByText("Não deu para gerar agora. Tente de novo.")).toBeVisible();
    if (testInfo.project.name === "desktop") await shootMatrix(page, "dono-reemitir-limite");
    await limitedDialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(limitedRow).toContainText("Aguardando pagamento");
  } finally {
    await clearCreateLimit(limitHash);
  }
});

test("limite da cliente pede para tentar de novo sem perder o horário", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
  await page.getByRole("textbox", { name: "WhatsApp do negócio" }).fill("+5511988887777");
  await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
  await expect(page.getByRole("status").filter({ hasText: "WhatsApp salvo." })).toBeVisible();
  await page.route(`**/api/public/${meta.businessASlug}/slot-links/**`, (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "retry-after": "10" },
      body: JSON.stringify({ error: { code: "rate_limited", message: "interno" } }),
    });
  });
  try {
    await page.goto(`/${meta.businessASlug}/h/${"g".repeat(43)}`);
    await expect(page.getByRole("heading", { name: "Não conseguimos carregar agora." })).toBeVisible();
    await expect(page.getByText("Seu horário não foi perdido. Tente de novo em alguns segundos.")).toBeVisible();
    const retry = page.getByRole("button", { name: /Tentar de novo em \d+s/ });
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveClass(/bg-pix/);
    const talk = page.getByRole("link", { name: "Falar com a loja" });
    await expect(talk).toHaveAttribute("href", "https://wa.me/5511988887777");
    await expect(talk).toHaveClass(/border/);
    if (testInfo.project.name === "desktop") await shootMatrix(page, "cliente-tentar-de-novo");
  } finally {
    await page.unroute(`**/api/public/${meta.businessASlug}/slot-links/**`).catch(() => undefined);
    await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
    await page.getByRole("textbox", { name: "WhatsApp do negócio" }).fill("");
    await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
    await expect(page.getByRole("status").filter({ hasText: "WhatsApp salvo." })).toBeVisible();
  }
});

test("404 do acompanhamento pede o link novo sem dizer que está confirmado", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const bookingId = "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c";
  const title = "Este link de acompanhamento foi atualizado. Para ver os detalhes do seu agendamento, fale com a loja.";
  const support = "Procure a mensagem da loja no seu WhatsApp para falar com ela.";
  await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
  await page.getByRole("textbox", { name: "WhatsApp do negócio" }).fill("+5511988887777");
  await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
  await expect(page.getByRole("status").filter({ hasText: "WhatsApp salvo." })).toBeVisible();
  await page.route(`**/api/public/${meta.businessASlug}/bookings/${bookingId}/payment`, (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "booking_not_found", message: "Agendamento não encontrado." } }),
  }));
  const openTracking = async () => {
    await page.goto(`/${meta.businessASlug}`);
    await page.evaluate(({ id, key }) => {
      sessionStorage.setItem(key, JSON.stringify({
        bookingId: id,
        accessToken: "token-original",
        expiresAt: "2030-01-01T16:00:00.000Z",
        serviceId: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b",
      }));
    }, { id: bookingId, key: `booking_session_${meta.businessASlug}` });
    await page.goto(`/${meta.businessASlug}?bookingId=${bookingId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Agendamento não encontrado.")).toHaveCount(0);
    await expect(page.getByText(/confirmado/i)).toHaveCount(0);
  };
  try {
    await openTracking();
    const talk = page.getByRole("link", { name: "Falar com a loja" });
    await expect(talk).toHaveAttribute("href", "https://wa.me/5511988887777");
    await expect(talk).toHaveClass(/bg-pix-deep/);
    await expect(talk).toHaveClass(/text-slab-foreground/);
    if (testInfo.project.name === "desktop") await shootMatrix(page, "acompanhamento-404-botao");

    await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
    await page.getByRole("textbox", { name: "WhatsApp do negócio" }).fill("");
    await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
    await expect(page.getByRole("status").filter({ hasText: "WhatsApp salvo." })).toBeVisible();
    await openTracking();
    await expect(page.getByText(support)).toBeVisible();
    await expect(page.getByRole("link", { name: "Falar com a loja" })).toHaveCount(0);
    if (testInfo.project.name === "desktop") await shootMatrix(page, "acompanhamento-404-apoio");
  } finally {
    await page.unroute(`**/api/public/${meta.businessASlug}/bookings/${bookingId}/payment`).catch(() => undefined);
    await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
    await page.getByRole("textbox", { name: "WhatsApp do negócio" }).fill("");
    await page.getByRole("button", { name: "Salvar WhatsApp" }).click();
    await expect(page.getByRole("status").filter({ hasText: "WhatsApp salvo." })).toBeVisible();
  }
});
