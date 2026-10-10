import { expect } from "@playwright/test";
import { test, expectNoAxeViolations, expectNoHorizontalOverflow, ownerStorageState, readMeta } from "./helpers";

const meta = readMeta();

test.describe("cadastro da loja vazio", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("abre sem exemplo, recusa gif e arquivo grande, e a prévia usa traço", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Sua loja" })).toBeVisible();
    await expect(page.getByLabel("Nome da loja")).toHaveValue("");
    await expect(page.getByLabel("Seu link")).toHaveValue("");
    await expect(page.getByLabel("Duração")).toHaveValue("");
    await expect(page.getByLabel("Nome do serviço")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await expect(page.getByText("Salvo neste aparelho")).toHaveCount(0);

    const file = page.locator("input[type=file]");
    await file.setInputFiles({ name: "anim.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await expect(page.locator("#store-logo-error")).toHaveText("Formato não aceito. Envie PNG, JPEG ou WebP.");
    await file.setInputFiles({
      name: "grande.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(Math.ceil(2.1 * 1024 * 1024)),
    });
    await expect(page.getByText("A imagem tem 2,1 MB. O limite é 2 MB.")).toBeVisible();

    await page.getByRole("button", { name: "Ver prévia" }).click();
    const sheet = page.getByRole("dialog", { name: "Prévia" });
    await expect(sheet).toContainText("—");
    await expect(sheet).not.toContainText("Studio da Ana");
    await expect(sheet).not.toContainText("Corte masculino");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page, "onboarding da loja em 360");
  });

  test("rascunho do aparelho pede continuar ou começar do zero", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("agenda_onboarding_draft", JSON.stringify({
        v: 1,
        savedAt: new Date().toISOString(),
        boundEmail: null,
        data: {
          plan: "base",
          businessName: "Studio Real",
          slug: "studio-real",
          slugTouched: true,
          serviceName: "Barba",
          durationMinutes: 30,
          priceCents: 4000,
          depositCents: 0,
          depositMode: "none",
          openDays: [1],
          opensAt: "10:00",
          closesAt: "18:00",
          email: "",
        },
      }));
    });
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Continuar o cadastro deste aparelho?" })).toBeVisible();
    await expect(page.getByText("Studio Real")).toBeVisible();
    await page.getByRole("button", { name: "Começar do zero" }).click();
    await expect(page.getByRole("heading", { name: "Sua loja" })).toBeVisible();
    await expect(page.getByLabel("Nome da loja")).toHaveValue("");
    const stored = await page.evaluate(() => localStorage.getItem("agenda_onboarding_draft"));
    expect(stored).toBeNull();
  });
});

test.describe("configurações da loja", () => {
  test.use({ storageState: ownerStorageState });

  test("salva o nome digitado e não promete o link antigo", async ({ page }) => {
    await page.route("**/api/businesses/**/profile", async (route) => {
      const body = route.request().postDataJSON() as { name?: string; slug?: string };
      expect(body.name).toBe("Loja E2E editada");
      expect(body.name).not.toMatch(/Gordão|Studio da Ana/);
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto(`/dashboard/settings?businessId=${meta.businessAId}`);
    const name = page.getByLabel("Nome da loja");
    await expect(name).not.toHaveValue("");
    await name.fill("Loja E2E editada");
    const link = page.getByLabel("Seu link");
    const current = await link.inputValue();
    await link.fill(`${current}-novo`);
    await expect(page.getByText("vai continuar funcionando")).toBeVisible();
    await link.fill(current);
    await expect(page.getByText("vai continuar funcionando")).toHaveCount(0);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas.")).toBeVisible();
  });
});
