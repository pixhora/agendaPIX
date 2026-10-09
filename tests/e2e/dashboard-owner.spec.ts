import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { mercadopagoConnections, mpConnectionEvents } from "../../db/schema";
import { connectedMercadoPagoValues } from "../helpers/connected-mp";

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
    await expect(page.getByRole("heading", { name: "Recebimento", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mercado Pago", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sua página pública", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aparência", exact: true })).toBeVisible();
    await expect(page.getByText("Compartilhe este link para receber reservas com sinal via Pix.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "WhatsApp do negócio", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chave Pix do negócio" })).toHaveCount(0);
  });

  test("aceite do texto novo libera o sinal sem reconectar", async ({ page }) => {
    const database = getDb();
    const current = connectedMercadoPagoValues(meta.businessAId);
    await database.update(mercadopagoConnections).set({ consentVersion: "2026-09-01.v1" }).where(eq(mercadopagoConnections.businessId, meta.businessAId));
    try {
      await page.goto(`/dashboard/services?businessId=${meta.businessAId}`);
      await expect(page.getByRole("status").filter({ hasText: "Texto da devolução desatualizado" }).first()).toBeVisible();
      await page.goto(`/dashboard?businessId=${meta.businessAId}`);
      await expect(page.getByRole("heading", { name: "Aceite o texto novo da devolução automática" })).toBeVisible();
      await page.goto(`/dashboard/settings?businessId=${meta.businessAId}#recebimento`);
      await expect(page.getByText("Aceite o texto novo para voltar a receber sinal")).toBeVisible();
      await expect(page.getByText("Não precisa entrar de novo no Mercado Pago.")).toBeVisible();
      await page.locator("label").filter({ hasText: "Entendi e autorizo" }).click();
      await page.getByRole("button", { name: "Aceitar e voltar a receber sinal" }).click();
      await expect(page.getByRole("button", { name: "Reconectar" })).toBeVisible();
      await expect(page.getByText("Aceite o texto novo para voltar a receber sinal")).toHaveCount(0);
      await page.goto(`/dashboard/services?businessId=${meta.businessAId}`);
      await expect(page.getByRole("status").filter({ hasText: "Texto da devolução desatualizado" })).toHaveCount(0);
    } finally {
      await database.update(mercadopagoConnections).set({
        consentVersion: current.consentVersion,
        consentTextSha256: current.consentTextSha256,
        autoRefundAckAt: current.autoRefundAckAt,
        consentUserId: current.consentUserId,
      }).where(eq(mercadopagoConnections.businessId, meta.businessAId));
      await database.delete(mpConnectionEvents).where(eq(mpConnectionEvents.businessId, meta.businessAId));
    }
  });

  test("isolamento: negócio alheio não abre dados", async ({ page }) => {
    await page.goto(`/dashboard/services?businessId=${meta.businessBId}`);
    await expect(page.getByRole("heading", { name: "Negócio indisponível" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Corte E2E" })).toHaveCount(0);
  });
});
