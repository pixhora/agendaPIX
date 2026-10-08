import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const meta = JSON.parse(readFileSync(path.resolve("tests/e2e/.auth/meta.json"), "utf8")) as {
  businessAId: string;
  businessBId: string;
  ownerName: string;
};

test.describe("painel do dono — sem sessão", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("rotas protegidas redirecionam para o login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar na sua conta" })).toBeVisible();
  });

  test("login exibe formulário de link mágico", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("E-mail profissional")).toBeVisible();
    await expect(page.getByRole("button", { name: "Receber link de acesso" })).toBeVisible();
  });
});

test.describe("painel do dono — autenticado", () => {
  test.use({ storageState: path.resolve("tests/e2e/.auth/owner.json") });

  test("agenda carrega com o negócio do dono", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(meta.ownerName).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Painel" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Agenda", exact: true })).toBeVisible();
  });

  test("jornada: serviços, clientes e funcionamento", async ({ page }) => {
    await page.goto(`/dashboard/services?businessId=${meta.businessAId}`);
    await expect(page.getByRole("heading", { name: "Serviços e preços", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Corte E2E" })).toBeVisible();

    await page.goto(`/dashboard/customers?businessId=${meta.businessAId}`);
    await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cliente E2E" })).toBeVisible();

    await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
    await expect(page.getByRole("heading", { name: "Horários de funcionamento", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "WhatsApp do negócio", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chave Pix do negócio" })).toHaveCount(0);
  });

  test("isolamento: negócio alheio não abre dados", async ({ page }) => {
    await page.goto(`/dashboard/services?businessId=${meta.businessBId}`);
    await expect(page.getByRole("heading", { name: "Negócio indisponível" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Corte E2E" })).toHaveCount(0);
  });
});
