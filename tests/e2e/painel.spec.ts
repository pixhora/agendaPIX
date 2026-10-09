import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { test, expectNoAxeViolations, expectNoHorizontalOverflow, ownerStorageState, readMeta } from "./helpers";

const meta = readMeta();
const withBusiness = (path: string) => `${path}${path.includes("?") ? "&" : "?"}businessId=${meta.businessAId}`;

test.describe("painel do dono — jornadas", () => {
  test.use({ storageState: ownerStorageState });

  test("agenda do dia: KPIs, reserva confirmada e detalhe no painel lateral", async ({ page }) => {
    await page.goto(withBusiness("/dashboard"));
    await expect(page.getByRole("heading", { level: 1, name: "Agenda de Negócio E2E A" })).toBeVisible();
    const agendaHeader = page.locator("header").filter({ has: page.getByRole("heading", { level: 1, name: "Agenda de Negócio E2E A" }) });
    await expect(agendaHeader).not.toContainText("America/Sao_Paulo");
    await expect(agendaHeader).not.toContainText("horários em");
    const summary = page.getByRole("region", { name: "Resumo da agenda" });
    await expect(summary.getByText(/Receita via Pix/)).toBeVisible();
    // Hoje há ao menos o sinal da reserva semeada (R$ 10,00); a jornada da página pública pode somar outro.
    await expect(summary.getByText(/R\$\s?[1-9]\d*,\d{2}/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const row = page.getByRole("button", { name: /Cliente E2E/ }).first();
    await expect(row).toContainText("07:00");
    await row.click();
    const dialog = page.getByRole("dialog", { name: "Cliente E2E" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Corte E2E");
    await expect(dialog).toContainText("Confirmado · sinal pago");
    await expect(dialog.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /wa\.me\/5511987654321/);
    await expectNoAxeViolations(page, "painel: detalhe do agendamento");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("agenda: semana em colunas, navegação por dia e calendário", async ({ page }) => {
    await page.goto(withBusiness("/dashboard"));
    await page.getByRole("navigation", { name: "Visualização da agenda" }).getByRole("link", { name: "Semana" }).click();
    await expect(page).toHaveURL(/view=week/);
    await expect(page.getByRole("heading", { name: "Semana", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: /feira|sábado|domingo/ }).first()).toBeVisible();

    const nextWeek = page.getByRole("link", { name: "Próxima semana" });
    const nextDate = new URL((await nextWeek.getAttribute("href"))!, "http://x").searchParams.get("date")!;
    await nextWeek.click();
    await expect(page).toHaveURL(new RegExp(`date=${nextDate}`));
    await expect(page.getByRole("button", { name: /Escolher data/ })).toBeEnabled();

    await page.getByRole("button", { name: /Escolher data/ }).click();
    const calendar = page.getByRole("dialog", { name: "Calendário" });
    await expect(calendar).toBeVisible();
    await calendar.getByRole("button", { name: /próximo/i }).click();
    await calendar.getByRole("button", { name: /\b15 de / }).click();
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-15/);
  });

  test("serviços: cadastra um serviço novo e vê na lista", async ({ page }) => {
    const name = `Escova E2E ${randomUUID().slice(0, 6)}`;
    await page.goto(withBusiness("/dashboard/services"));
    await expect(page.getByRole("heading", { name: "Serviços e preços", exact: true })).toBeVisible();
    const form = page.getByRole("form", { name: "Cadastrar serviço" });
    await form.getByLabel("Nome do serviço").fill(name);
    await form.getByLabel("Duração (minutos)").fill("40");
    await form.getByLabel("Preço").fill("70,00");
    await form.getByLabel("Sinal via Pix").fill("20,00");
    await form.getByRole("button", { name: "Cadastrar serviço" }).click();
    await expect(page.getByText("Serviço salvo.").first()).toBeVisible();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expectNoAxeViolations(page, "painel: serviços");
  });

  test("clientes: lista com WhatsApp e ligação", async ({ page }) => {
    await page.goto(withBusiness("/dashboard/customers"));
    await expect(page.getByRole("heading", { name: "Cliente E2E" })).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp para Cliente E2E/ })).toHaveAttribute("href", /wa\.me\/5511987654321/);
    await expect(page.getByRole("link", { name: /Ligar para Cliente E2E/ })).toHaveAttribute("href", "tel:+5511987654321");
  });

  test("configurações: salva horários e mostra o link público", async ({ page }) => {
    await page.goto(withBusiness("/dashboard/settings"));
    await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
    await expect(page.getByText(meta.businessASlug).first()).toBeVisible();
    await expect(page.getByText("Fuso horário: Horário de Brasília.")).toBeVisible();
    await expect(page.getByText("America/Sao_Paulo")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Chave Pix do negócio" })).toHaveCount(0);
    await expect(page.getByLabel(/Chave Pix|Nova chave Pix/)).toHaveCount(0);

    const hours = page.getByRole("form", { name: "Horários de funcionamento" });
    await hours.getByLabel("Domingo: aberto").uncheck();
    await hours.getByRole("button", { name: "Salvar horários de funcionamento" }).click();
    await expect(page.getByText("Horários de funcionamento salvos.").first()).toBeVisible();
    await expectNoAxeViolations(page, "painel: configurações");
  });
});

test.describe("painel do dono — isolamento entre negócios", () => {
  test.use({ storageState: ownerStorageState });

  test("dono A não vê agenda nem clientes do negócio B", async ({ page }) => {
    for (const path of ["/dashboard", "/dashboard/customers", "/dashboard/settings"]) {
      await page.goto(`${path}?businessId=${meta.businessBId}`);
      await expect(page.getByRole("heading", { name: "Negócio indisponível" })).toBeVisible();
      await expect(page.getByText("Cliente E2E")).toHaveCount(0);
      await expect(page.getByText("Negócio E2E B")).toHaveCount(0);
    }
    const retiredPixKey = await page.request.get(`/api/businesses/${meta.businessBId}/pix-key`);
    expect(retiredPixKey.status()).toBe(410);
    expect(await retiredPixKey.json()).toEqual({ error: { code: "pix_key_retired" } });
  });
});
