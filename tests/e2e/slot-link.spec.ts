import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { expect, type Page } from "@playwright/test";
import { expectNoAxeViolations, ownerStorageState, readMeta, test } from "./helpers";

const meta = readMeta();
const shots = "/opt/cursor/artifacts/slot-link";

test.use({ storageState: ownerStorageState });

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

async function createLink(page: Page, service: string, date: string, time: string) {
  await page.goto(`/dashboard?businessId=${meta.businessAId}`);
  return page.evaluate(async ({ businessId, serviceId: id, date: day, time: hour }) => {
    const response = await fetch(`/api/businesses/${businessId}/slot-links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceId: id, date: day, time: hour }),
    });
    return { status: response.status, body: await response.json() };
  }, { businessId: meta.businessAId, serviceId: service, date, time });
}

const frames = [
  { name: "360", width: 360, height: 780 },
  { name: "390", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

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
        const dark = theme === "dark";
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.classList.toggle("light", !dark);
        document.documentElement.style.colorScheme = theme;
      }, scheme);
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
  await expect(page.getByRole("link", { name: "Crie a sua grátis" })).toHaveCount(0);
  if (testInfo.project.name === "desktop") await shootMatrix(page, "cliente-pix");
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
