import fs from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium, expect } = require("@playwright/test");
const { Pool } = require("pg");
const root = process.env.QA_DASHBOARD_FIXTURES;
if (!root) throw new Error("Defina QA_DASHBOARD_FIXTURES de ambiente sintético próprio.");
const fixture = JSON.parse(fs.readFileSync(join(root, "fixture.json")));
const environment = JSON.parse(fs.readFileSync(join(root, "env.json")));
const baseURL = process.env.QA_DASHBOARD_URL ?? "http://127.0.0.1:3343";
const databaseURL = new URL(environment.DATABASE_URL);
if (databaseURL.hostname !== "127.0.0.1" || databaseURL.port !== "55443" || databaseURL.pathname !== "/agenda_t2_b05" || new URL(baseURL).origin !== "http://127.0.0.1:3343") throw new Error("Ambiente não reconhecido como fixture local B05.");
const pool = new Pool({ connectionString: environment.DATABASE_URL });
const browser = await chromium.launch();
const results = [];
try {
  const context = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto("/dashboard/login");
  const start = Date.now();
  await page.getByLabel("Seu email").fill(fixture.email);
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(page.getByRole("status")).toContainText("Confira sua caixa de entrada");
  let magicLink = "";
  await expect.poll(() => {
    for (const name of fs.readdirSync(root).filter(name => /^email-.*\.eml$/.test(name))) {
      const path = join(root, name);
      if (fs.statSync(path).mtimeMs < start) continue;
      const mail = fs.readFileSync(path, "utf8").replace(/=\r?\n/g, "").replace(/=3D/g, "=").replace(/&amp;/g, "&");
      magicLink = mail.match(/https?:\/\/[^\s<>"']+\/api\/auth\/magic-link\/verify\?[^\s<>"']+/)?.[0] ?? magicLink;
    }
    return Boolean(magicLink);
  }).toBe(true);
  const verification = await context.request.get(magicLink).catch(() => { throw new Error("Verificação SMTP falhou; detalhes privados omitidos."); });
  expect(verification.status()).toBeLessThan(400);

  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    for (const route of ["", "/services", "/customers", "/settings"]) {
      await page.goto(`/dashboard${route}?businessId=${fixture.businessId}&date=${fixture.date}`);
      await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
      if (!route) {
        await expect(page.getByRole("heading", { name: "Cliente B05 QA" })).toBeVisible();
        await expect(page.getByText("Serviço B05 QA", { exact: true })).toBeVisible();
        await expect(page.locator('[data-status="confirmed"]')).toHaveText("Confirmado");
      }
      if (route === "/services") await expect(page.getByRole("heading", { name: "Serviço B05 QA" })).toBeVisible();
      if (route === "/settings") await expect(page.getByRole("group", { name: "Quarta-feira" }).getByLabel("Abre às")).toHaveValue("09:00");
      if (route === "/customers") {
        const link = page.getByRole("link", { name: "WhatsApp para Cliente B05 QA" });
        const url = new URL(await link.getAttribute("href"));
        expect(url.pathname).toBe("/5511999990000");
        expect(url.searchParams.get("text")).toBe("Olá, Cliente B05 QA! Aqui é Studio B05 QA.");
        expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await link.focus(); await expect(link).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(page.getByRole("link", { name: "Ligar para Cliente B05 QA" })).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `docs/evidencias/dashboard-b05/${route.slice(1) || "agenda"}-${width}.png`, fullPage: true });
      results.push({ route: `/dashboard${route}`, width, authenticated: true, noOverflow: true });
    }
  }
  await page.goto(`/dashboard/services?businessId=${fixture.businessId}`);
  await page.getByText("Editar serviço", { exact: true }).click();
  const form = page.getByRole("form", { name: "Editar Serviço B05 QA" });
  await form.getByLabel("Disponível para agendamento").uncheck();
  await form.getByRole("button", { name: "Salvar serviço", exact: true }).click();
  await expect(form.getByRole("status")).toHaveText("Serviço salvo.");
  expect((await pool.query("SELECT active FROM services WHERE id=$1", [fixture.serviceId])).rows[0].active).toBe(false);
  await page.reload();
  await page.getByText("Editar serviço", { exact: true }).click();
  await expect(form.getByLabel("Disponível para agendamento")).not.toBeChecked();
  await form.getByLabel("Disponível para agendamento").check();
  await form.getByRole("button", { name: "Salvar serviço", exact: true }).click();
  await expect(form.getByRole("status")).toHaveText("Serviço salvo.");
  expect((await pool.query("SELECT active FROM services WHERE id=$1", [fixture.serviceId])).rows[0].active).toBe(true);
  const counts = (await pool.query("SELECT (SELECT count(*) FROM bookings WHERE business_id=$1)::int AS bookings, (SELECT count(*) FROM services WHERE business_id=$1)::int AS services, (SELECT count(*) FROM customers WHERE business_id=$1)::int AS customers, (SELECT count(*) FROM business_hours WHERE business_id=$1)::int AS hours", [fixture.businessId])).rows[0];
  fs.writeFileSync("docs/evidencias/dashboard-b05/results.json", JSON.stringify({ base: "f4b4361", baseURL, auth: "SMTP local e sessão Better Auth reais; nenhum bypass ou HTTP mock", results, dbCounts: counts, serviceDeactivateReloadReactivate: true, pix: "API ausente desta branch; sem validação Pix integrada" }, null, 2));
  console.log(JSON.stringify({ cases: results.length, dbCounts: counts, serviceDeactivateReloadReactivate: true }));
} finally {
  await browser.close(); await pool.end();
}
