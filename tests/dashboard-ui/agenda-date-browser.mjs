import fs from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const { chromium, expect } = createRequire(import.meta.url)("@playwright/test");
const root = process.env.QA_DASHBOARD_FIXTURES;
if (!root) throw new Error("Defina QA_DASHBOARD_FIXTURES sintética.");
const fixture = JSON.parse(fs.readFileSync(join(root, "fixture.json")));
const baseURL = "http://127.0.0.1:3343";
const browser = await chromium.launch();
const results = [];
try {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/dashboard/login");
  const start = Date.now();
  await page.getByLabel("Seu email").fill(fixture.email);
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(page.getByRole("status")).toContainText("Confira sua caixa de entrada");
  let link = "";
  await expect.poll(() => {
    for (const name of fs.readdirSync(root).filter(name => /^email-.*\.eml$/.test(name))) {
      const path = join(root, name);
      if (fs.statSync(path).mtimeMs < start) continue;
      const mail = fs.readFileSync(path, "utf8").replace(/=\r?\n/g, "").replace(/=3D/g, "=").replace(/&amp;/g, "&");
      link = mail.match(/https?:\/\/[^\s<>"']+\/api\/auth\/magic-link\/verify\?[^\s<>"']+/)?.[0] ?? link;
    }
    return Boolean(link);
  }).toBe(true);
  await context.request.get(link).catch(() => { throw new Error("Verificação SMTP falhou; detalhes privados omitidos."); });
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(`/dashboard?businessId=${fixture.businessId}&date=2030-01-02`);
    const date = page.getByLabel("Data", { exact: true });
    await expect(date).toHaveValue("2030-01-02");
    await date.fill("2030-01-10");
    await page.getByRole("link", { name: "Próximo dia", exact: true }).click();
    await page.waitForURL("**date=2030-01-03**");
    await expect(date).toHaveValue("2030-01-03");
    await page.getByRole("link", { name: "Dia anterior", exact: true }).click();
    await page.waitForURL("**date=2030-01-02**");
    await expect(date).toHaveValue("2030-01-02");
    await date.fill("2030-01-10");
    await page.getByRole("button", { name: "Ver horários", exact: true }).click();
    await page.waitForURL("**date=2030-01-10**");
    await expect(date).toHaveValue("2030-01-10");
    await page.getByRole("link", { name: "Semana", exact: true }).click();
    await page.waitForURL("**view=week**");
    await expect(date).toHaveValue("2030-01-10");
    await page.getByRole("link", { name: "Próxima semana", exact: true }).click();
    await page.waitForURL("**date=2030-01-17**");
    await expect(date).toHaveValue("2030-01-17");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/evidencias/dashboard-date-sync/agenda-${width}.png`, fullPage: true });
    results.push({ width, nextDay: true, previousDay: true, applyGet: true, nextWeek: true, inputMatchesURL: true, noOverflow: true });
  }
  fs.writeFileSync("docs/evidencias/dashboard-date-sync/results.json", JSON.stringify({ baseURL, auth: "SMTP sintético e sessão reais, sem bypass", results }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
