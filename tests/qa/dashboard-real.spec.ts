import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const evidenceDirectory = process.env.QA_DASHBOARD_FIXTURES ?? "/tmp/agenda-t2-final";

test("painel real: login SMTP, sessão, serviços, horários, tenant e agenda", async ({ page, context, baseURL }, testInfo) => {
  const fixture = JSON.parse(readFileSync(join(evidenceDirectory, "fixture.json"), "utf8")) as { email: string; ownerId: string; businessId: string; date: string };
  const privateEnvironment = JSON.parse(readFileSync(join(evidenceDirectory, "env.json"), "utf8")) as { DATABASE_URL: string };
  const pool = new Pool({ connectionString: privateEnvironment.DATABASE_URL });
  const businessId = randomUUID(), foreignOwner = randomUUID(), foreignBusiness = randomUUID();
  let initialized = false;
  try {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard\/login/);
    const mailStart = Date.now();
    await page.getByLabel("Seu email").fill(fixture.email);
    await page.getByRole("button", { name: "Receber link de acesso" }).click();
    // Falha aqui comprova bloqueio no envio/autenticação; não contornar criando sessão.
    await expect(page.getByRole("status")).toContainText("Confira sua caixa de entrada");
    let magicLink = "";
    await expect.poll(() => {
      for (const name of readdirSync(evidenceDirectory).filter(name => /^email-.*\.eml$/.test(name))) {
        const path = join(evidenceDirectory, name);
        if (statSync(path).mtimeMs < mailStart) continue;
        const mail = readFileSync(path, "utf8").replace(/=\r?\n/g, "").replace(/=3D/g, "=").replace(/&amp;/g, "&");
        const matches = mail.match(/https?:\/\/[^\s<>"']+\/api\/auth\/magic-link\/verify\?[^\s<>"']+/g);
        if (matches?.length) magicLink = matches[0];
      }
      return Boolean(magicLink);
    }, { message: "SMTP local entrega link mágico" }).toBe(true);
    const verification = await context.request.get(magicLink).catch(() => { throw new Error("Falha ao consumir link SMTP; detalhes privados omitidos."); });
    expect(verification.status(), "link recebido pelo SMTP cria sessão").toBeLessThan(400);
    const replay = await context.request.get(magicLink, { maxRedirects: 0 }).catch(() => { throw new Error("Falha ao verificar uso único; detalhes privados omitidos."); });
    expect(replay.status() >= 400 || Boolean(replay.headers().location?.includes("error")), "link consumido é rejeitado, inclusive por limite de tentativas").toBe(true);
    await page.goto(`/dashboard?businessId=${fixture.businessId}&date=${fixture.date}`);
    await expect(page.getByRole("heading", { name: /^Agenda de/ })).toBeVisible();
    await page.getByRole("link", { name: "Semana", exact: true }).click();
    await expect(page.getByRole("link", { name: "Semana", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("main section")).toHaveCount(7);
    await pool.query('INSERT INTO "user" (id, name, email) VALUES ($1,$2,$3)', [foreignOwner, "Dono QA isolado", `${foreignOwner}@example.com`]);
    await pool.query("INSERT INTO businesses (id, owner_id, name, slug) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)", [businessId, fixture.ownerId, "Negócio QA E2E", `qa-${businessId}`, foreignBusiness, foreignOwner, "Negócio alheio QA", `qa-${foreignBusiness}`]);
    initialized = true;
    await page.goto(`/dashboard/services?businessId=${businessId}`);
    await expect(page.getByText("Seu primeiro serviço começa aqui")).toBeVisible();
    const form = page.getByRole("form", { name: "Cadastrar serviço", exact: true });
    await form.getByLabel("Nome do serviço").fill("Serviço QA integrado");
    await form.getByLabel("Duração (minutos)").fill("45");
    await form.getByLabel("Preço (R$)").fill("80,35");
    await form.getByLabel("Sinal (R$)").fill("90,00");
    await form.getByRole("button", { name: "Cadastrar serviço" }).click();
    await expect(form.getByRole("alert")).toBeVisible();
    await form.getByLabel("Sinal (R$)").fill("20,15");
    await form.getByRole("button", { name: "Cadastrar serviço" }).click();
    await expect(form.getByRole("status")).toHaveText("Serviço salvo.");
    const service = (await pool.query("SELECT id, price_cents, deposit_cents FROM services WHERE business_id=$1", [businessId])).rows[0];
    expect(service.price_cents).toBe(8035); expect(service.deposit_cents).toBe(2015);
    await page.reload();
    const row = page.locator("li").filter({ has: page.getByRole("heading", { name: "Serviço QA integrado", exact: true }) });
    await row.getByText("Editar serviço", { exact: true }).click();
    const edit = row.getByRole("form");
    await edit.getByLabel("Preço (R$)").fill("85,90");
    await edit.getByRole("button", { name: "Salvar serviço" }).click();
    await expect(edit.getByRole("status")).toHaveText("Serviço salvo.");
    expect((await pool.query("SELECT price_cents FROM services WHERE id=$1", [service.id])).rows[0].price_cents).toBe(8590);
    await edit.getByLabel("Nome do serviço").fill("Tentativa tenant QA");
    await edit.locator('input[name="businessId"]').evaluate((element, value) => { (element as HTMLInputElement).value = value; }, foreignBusiness);
    await edit.getByRole("button", { name: "Salvar serviço" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect((await pool.query("SELECT name FROM services WHERE id=$1", [service.id])).rows[0].name).toBe("Serviço QA integrado");
    await page.goto(`/dashboard/services?businessId=${foreignBusiness}`);
    await expect(page.getByRole("heading", { name: "Negócio indisponível" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Cadastrar serviço" })).toHaveCount(0);
    await page.goto(`/dashboard/settings?businessId=${businessId}`);
    const hours = page.getByRole("form", { name: "Horários de funcionamento" });
    const monday = hours.getByRole("group", { name: "Segunda-feira" });
    await monday.getByLabel("Aberto", { exact: true }).check();
    await monday.getByLabel("Abre às").fill("09:30");
    await monday.getByLabel("Fecha às").fill("17:30");
    await hours.getByRole("button", { name: "Salvar horários de funcionamento" }).click();
    await expect(hours.getByRole("status")).toHaveText("Horários de funcionamento salvos.");
    expect((await pool.query("SELECT weekday, opens_at, closes_at FROM business_hours WHERE business_id=$1", [businessId])).rows).toEqual([{ weekday: 1, opens_at: "09:30:00", closes_at: "17:30:00" }]);
    await page.reload();
    await expect(page.getByRole("group", { name: "Segunda-feira" }).getByLabel("Abre às")).toHaveValue("09:30");
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      for (const route of ["", "/services", "/customers", "/settings"]) {
        await page.goto(`/dashboard${route}?businessId=${businessId}`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} ${width}px sem overflow`).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`dashboard${route.replaceAll("/", "-") || "-agenda"}-${width}.png`) });
      }
    }
    const anonymous = await context.browser()!.newContext({ baseURL });
    const noSession = await anonymous.newPage();
    await noSession.goto(`/dashboard/services?businessId=${businessId}`);
    await expect(noSession).toHaveURL(/\/dashboard\/login/);
    await anonymous.close();
  } finally {
    if (initialized) {
      await pool.query("DELETE FROM business_hours WHERE business_id=$1", [businessId]);
      await pool.query("DELETE FROM services WHERE business_id=$1", [businessId]);
      await pool.query("DELETE FROM businesses WHERE id = ANY($1::uuid[])", [[businessId, foreignBusiness]]);
    }
    await pool.query('DELETE FROM "user" WHERE id=$1', [foreignOwner]);
    await pool.end();
  }
});
