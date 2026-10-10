import { expect } from "@playwright/test";
import { test, ownerStorageState, readMeta } from "./helpers";

/**
* Regressão visual: landing, cadastro público e painel do dono em 4 larguras e 2 temas.
 * Roda só no projeto desktop (o viewport é trocado aqui). Baselines em tests/e2e/visual.spec.ts-snapshots.
 */
const widths = [375, 390, 768, 1440] as const;
const pages = [
  { name: "landing", path: "/" },
  { name: "cadastro", path: "/onboarding" },
] as const;

test.describe("regressão visual", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const theme of ["light", "dark"] as const) {
    for (const width of widths) {
      for (const target of pages) {
        test(`${target.name} ${theme} ${width}px`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== "desktop", "projeto desktop troca o viewport");
          await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), theme);
          // Movimento reduzido: a composição do hero fica parada, e a captura fica determinística.
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
          await page.goto(target.path, { waitUntil: "load" });
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => document.fonts.ready);
          await expect(page).toHaveScreenshot(`${target.name}-${theme}-${width}.png`, {
            fullPage: false,
            animations: "disabled",
            maxDiffPixelRatio: 0.01,
            // Padrão 0.2 deixa passar troca de fundo escuro (cores escuras parecem iguais no YIQ).
            threshold: 0.02,
          });
        });
      }
    }
  }
});

/**
 * Painel do dono (logado como dono A). A data da agenda é fixa (seed do global setup),
 * para o conteúdo não mudar de um dia para o outro.
 */
const DATE_DEPENDENT = /outubro|\bout\.|hoje|amanhã|ontem|restam|termina|teste grátis/i;

const dashboardPages = [
  { name: "agenda", path: (meta: ReturnType<typeof readMeta>) => `/dashboard?date=${meta.agendaDate}&businessId=${meta.businessAId}` },
  { name: "servicos", path: (meta: ReturnType<typeof readMeta>) => `/dashboard/services?businessId=${meta.businessAId}` },
  { name: "clientes", path: (meta: ReturnType<typeof readMeta>) => `/dashboard/customers?businessId=${meta.businessAId}` },
  { name: "configuracoes", path: (meta: ReturnType<typeof readMeta>) => `/dashboard/settings?businessId=${meta.businessAId}` },
] as const;

test.describe("regressão visual do painel", () => {
  test.use({ storageState: ownerStorageState });

  for (const theme of ["light", "dark"] as const) {
    for (const width of widths) {
      for (const target of dashboardPages) {
        test(`painel ${target.name} ${theme} ${width}px`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== "desktop", "projeto desktop troca o viewport");
          const meta = readMeta();
          await page.addInitScript((value) => localStorage.setItem("agenda-theme", value), theme);
          // Movimento reduzido: a sequência animada do hero vira o estado final, e a captura fica determinística.
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
          await page.goto(target.path(meta), { waitUntil: "load" });
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => document.fonts.ready);
          // Textos que dependem do dia de execução (data, "hoje", contagem do teste grátis) ficam fora da comparação.
          const dateDependent = page.getByText(DATE_DEPENDENT);
          await expect(page).toHaveScreenshot(`painel-${target.name}-${theme}-${width}.png`, {
            fullPage: false,
            animations: "disabled",
            mask: [dateDependent],
            maxDiffPixelRatio: 0.01,
            // Padrão 0.2 deixa passar troca de fundo escuro (cores escuras parecem iguais no YIQ).
            threshold: 0.02,
          });
        });
      }
    }
  }
});
