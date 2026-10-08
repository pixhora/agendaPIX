import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

export type E2EMeta = {
  ownerEmail: string;
  foreignEmail: string;
  businessAId: string;
  businessBId: string;
  businessASlug: string;
  businessBSlug: string;
  ownerName: string;
};

export function readMeta(): E2EMeta {
  return JSON.parse(readFileSync(path.resolve("tests/e2e/.auth/meta.json"), "utf8")) as E2EMeta;
}

export const ownerStorageState = path.resolve("tests/e2e/.auth/owner.json");

/**
 * `test` com o indicador do `next dev` (nextjs-portal) escondido: ele só existe em desenvolvimento
 * e fica por cima de controles do canto inferior esquerdo no celular.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = "nextjs-portal{display:none!important}";
        document.head.append(style);
      });
    });
    await provide(page);
  },
});

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function summarize(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.slice(0, 5).map((node) => `${node.target.join(" ")} → ${node.failureSummary?.split("\n").slice(1, 2).join("").trim()}`).join(" | ")}`);
}

/**
 * Axe com as regras WCAG 2.0/2.1/2.2 A e AA. Falha listando regra, impacto, alvos e motivo.
 * `target-size` (2.5.8) roda à parte com as barras fixas do painel (`data-sticky-chrome`) no fluxo:
 * elas são sticky e o conteúdo rola por baixo delas (com scroll-padding), então não contam como obstrução.
 * Toasts transitórios também ficam de fora dessa checagem. No contraste, a entrada do toast
 * fica opaca: no meio do fade o axe mede cinza sobre cinza.
 */
export async function expectNoAxeViolations(page: Page, context: string) {
  const settled = await page.addStyleTag({ content: "[data-sonner-toast]{opacity:1!important;animation:none!important;transition:none!important}" });
  const main = await new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules(["target-size"]).exclude("nextjs-portal").analyze();
  await settled.evaluate((element) => (element as Element).remove());
  const style = await page.addStyleTag({ content: "[data-sticky-chrome]{position:static!important}[data-sonner-toaster]{display:none!important}" });
  const targets = await new AxeBuilder({ page }).withRules(["target-size"]).exclude("nextjs-portal").analyze();
  await style.evaluate((element) => (element as Element).remove());
  expect([...summarize(main.violations), ...summarize(targets.violations)], `Violações de acessibilidade em ${context}`).toEqual([]);
}

/** Reflow (WCAG 1.4.10): nada de rolagem horizontal na largura do projeto. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "largura do documento maior que a janela").toBeLessThanOrEqual(1);
}
