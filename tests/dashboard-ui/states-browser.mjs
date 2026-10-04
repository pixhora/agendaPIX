import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium, expect } from "@playwright/test";
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(viteRequire.resolve("vite"));
const root = process.cwd();
const server = await createServer({
  configFile: false, root,
  define: { "process.env.NEXT_PUBLIC_BACKEND_URL": JSON.stringify("http://localhost:3000") },
  resolve: { alias: [
    { find: "@/app/dashboard/(owner)/actions", replacement: path.join(root, "tests/dashboard-ui/states-actions.fixture.ts") },
    { find: "@", replacement: root },
  ] },
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "baseline-form-proof", enforce: "pre", load(id) {
    if (process.env.QA_STATES_BASELINE && id === path.join(root, "components/dashboard/forms.tsx")) {
      return execFileSync("git", ["show", `${process.env.QA_STATES_BASELINE}:components/dashboard/forms.tsx`], { encoding: "utf8" });
    }
  } }, { name: "isolated-dashboard-states", configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== "/__qa") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/dashboard-ui/states-fixture.tsx"></script></body></html>`);
    });
  } }],
});
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch();
const results = [];
try {
  for (const reducedMotion of ["reduce", "no-preference"]) {
    for (const width of [375, 1280]) {
      for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width, height: 812 }, reducedMotion, colorScheme });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => { errors.push(error.message); console.error("harness pageerror:", error.message); });
      await page.route("http://localhost:3000/api/businesses/business-test/pix-key", async route => {
        const method = route.request().method();
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(method === "PUT" ? { configured: true, type: "email", hint: "t***@example.com" } : { configured: false, type: null, hint: null }) });
      });
      await page.goto(`http://localhost:${port}/__qa`);
      const service = page.getByRole("form", { name: "Cadastrar serviço", exact: true });
      await expect(service).toBeVisible({ timeout: 15_000 });
      await service.getByLabel("Nome do serviço").fill("Corte QA");
      await service.getByLabel("Preço (R$)").fill("49,00");
      await service.getByRole("button", { name: "Cadastrar serviço", exact: true }).click();
      await expect(service.getByRole("status")).toHaveText("Salvando alterações…");
      await expect(service.getByRole("status")).toHaveText("Serviço salvo.");
      await service.getByLabel("Nome do serviço").fill("Novo corte QA");
      await expect(service.getByRole("status")).toHaveCount(0);
      await expect(service.getByLabel("Nome do serviço")).toBeFocused();
      await page.evaluate(() => { window.qaActionFailure = true; });
      await service.getByRole("button", { name: "Cadastrar serviço", exact: true }).click();
      await expect(service.getByRole("alert")).toBeFocused();
      await expect(service.getByLabel("Nome do serviço")).toHaveValue("Novo corte QA");
      await service.getByLabel("Nome do serviço").fill("Correção QA");
      await expect(service.getByLabel("Nome do serviço")).toBeFocused();
      await page.evaluate(() => { window.qaActionFailure = false; });
      await service.getByRole("button", { name: "Cadastrar serviço", exact: true }).click();
      await expect(service.getByRole("status")).toHaveText("Serviço salvo.");
      const hours = page.getByRole("form", { name: "Horários de funcionamento", exact: true });
      await expect(hours.getByRole("status")).toContainText("Nenhum dia selecionado");
      await hours.getByRole("checkbox").nth(1).check();
      await expect(hours.getByRole("status")).toHaveCount(0);
      await hours.getByRole("button", { name: "Salvar horários de funcionamento" }).click();
      await expect(hours.getByRole("status")).toHaveText("Horários de funcionamento salvos.");
      await hours.getByLabel("Abre às").nth(1).fill("10:00");
      await expect(hours.getByRole("status")).toHaveCount(0);
      const pix = page.getByRole("region", { name: "Chave Pix do negócio" });
      await expect(pix).toContainText("Nenhuma chave Pix configurada");
      await pix.getByLabel("Tipo de chave").selectOption("email");
      await pix.getByLabel("Chave Pix", { exact: true }).fill("test@example.com");
      await pix.getByRole("button", { name: "Salvar chave" }).click();
      await expect(pix.getByRole("status")).toHaveText("Chave Pix salva com segurança.");
      await expect(pix.getByLabel("Nova chave Pix")).toHaveValue("");
      await pix.getByLabel("Nova chave Pix").fill("replacement@example.com");
      await expect(pix.getByRole("status")).toHaveCount(0);
      await service.getByRole("button", { name: "Cadastrar serviço", exact: true }).click();
      await expect(service.getByRole("status")).toHaveText("Serviço salvo.");
      if (reducedMotion === "reduce") {
        expect(await service.getByRole("status").evaluate(el => getComputedStyle(el).animationName)).toBe("none");
        expect(await service.getByRole("button").evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0s");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: `docs/evidencias/dashboard-states/states-${width}-${colorScheme}-${reducedMotion}.png`, fullPage: true });
      results.push({ width, colorScheme, reducedMotion, successAfterResponse: true, staleSuccessRemoved: true, errorRecovery: true, focusDataPreserved: true, emptyHoursPix: true, noOverflow: true });
      await context.close();
      }
    }
  }
  fs.writeFileSync("docs/evidencias/dashboard-states/results.json", JSON.stringify({ mode: "Componentes reais; ações/Pix controlados, sem DB/sessão", results }, null, 2));
  console.log(`${results.length}/8 states browser OK`);
} finally { await browser.close(); await server.close(); }
