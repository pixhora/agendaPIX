import fs from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

// Fixture privada de sessão sintética. A prova não envia email nem cria dados de negócio.
const fixturePath = process.env.QA_DASHBOARD_FIXTURE;
if (!fixturePath) throw new Error("Defina QA_DASHBOARD_FIXTURE com uma sessão sintética válida.");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (fixture.baseURL !== "http://localhost:3343" || fixture.authority !== "http://localhost:3000"
  || fixture.targetOrigin !== "http://127.0.0.2:3343" || Date.parse(fixture.expiresAt) <= Date.now()) {
  throw new Error("Fixture fora do ambiente local esperado ou sessão expirada.");
}
const output = "docs/evidencias/dashboard-v2/authenticated";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const routes = [
  { name: "agenda", pathname: "/dashboard" },
  { name: "semana", pathname: "/dashboard", view: "week" },
  { name: "servicos", pathname: "/dashboard/services" },
  { name: "clientes", pathname: "/dashboard/customers" },
  { name: "funcionamento", pathname: "/dashboard/settings" },
];

try {
  for (const width of [375, 1280]) {
    for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({
        baseURL: fixture.baseURL, viewport: { width, height: 812 }, colorScheme, reducedMotion: "reduce",
      });
      await context.addCookies([{
        name: fixture.cookieName, value: fixture.cookieValue, domain: "localhost", path: "/",
        httpOnly: true, sameSite: "Lax", expires: Date.parse(fixture.expiresAt) / 1000,
      }]);
      // Proxy de transporte: mantém origem/cookies/CORS reais e encaminha ao build isolado.
      // Nenhum corpo de resposta é simulado; o preview em 127.0.0.1:3343 permanece ativo.
      await context.route(`${fixture.baseURL}/**`, async (route) => {
        const request = route.request();
        const response = await route.fetch({
          url: request.url().replace(fixture.baseURL, fixture.targetOrigin),
          headers: { ...request.headers(), host: "localhost:3343" },
          maxRedirects: 0,
        });
        await route.fulfill({ response });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      for (const route of routes) {
        errors.length = 0;
        const query = new URLSearchParams({ businessId: fixture.businessId });
        if (route.view) query.set("view", route.view);
        const response = await page.goto(`${route.pathname}?${query}`);
        expect(response.status()).toBe(200);
        await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
        if (route.name === "agenda") {
          await expect(page.getByRole("region", { name: "Sinais confirmados do dia" })).toContainText("R$\u00a00,00");
          await expect(page.getByRole("heading", { name: "Nenhum atendimento neste período" })).toBeVisible();
        }
        if (route.name === "semana") {
          await expect(page.getByText("Sem atendimentos.", { exact: true })).toHaveCount(7);
        }
        if (route.name === "servicos") {
          await expect(page.getByRole("heading", { name: "Serviço sintético B02", exact: true })).toBeVisible();
        }
        if (route.name === "clientes") {
          await expect(page.getByRole("heading", { name: "Ainda não há clientes" })).toBeVisible();
        }
        if (route.name === "funcionamento") {
          const pix = page.getByRole("region", { name: "Chave Pix do negócio" });
          await expect(pix).toHaveAttribute("aria-busy", "false");
          await expect(pix.getByRole("alert")).toHaveCount(0);
          await expect(page.getByRole("form", { name: "Horários de funcionamento" }).getByRole("checkbox", { checked: true })).toHaveCount(fixture.counts.hours);
        }
        const links = page.getByRole("navigation", { name: "Painel", exact: true }).getByRole("link");
        await links.first().focus();
        await page.keyboard.press("Tab");
        await expect(links.nth(1)).toBeFocused();
        const focus = await links.nth(1).evaluate(element => {
          const style = getComputedStyle(element);
          return { color: style.outlineColor, width: style.outlineWidth, transition: style.transitionDuration };
        });
        expect(focus.color).toBe(colorScheme === "dark" ? "rgb(192, 247, 57)" : "rgb(11, 11, 12)");
        expect(focus.width).toBe("2px");
        expect(focus.transition).toBe("0s");
        for (const link of await links.all()) expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(errors).toEqual([]);
        await page.screenshot({ path: path.join(output, `${route.name}-${width}-${colorScheme}.png`), fullPage: true });
        results.push({ route: route.pathname, view: route.view ?? "day", width, colorScheme, http: response.status(), authenticated: true, noOverflow: true, consoleErrors: errors.length, focusVisible: true, reducedMotion: true });
      }
      await context.close();
    }
  }
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({
    mode: "Build real, sessão sintética validada pela autoridade e leituras PostgreSQL reais; sem mocks de resposta, sem SMTP, sem gravação de dados de negócio",
    authority: fixture.authority, baseURL: fixture.baseURL, transportTarget: fixture.targetOrigin,
    counts: fixture.counts, results,
  }, null, 2));
  console.log(`${results.length}/20 capturas autenticadas OK`);
} finally { await browser.close(); }
