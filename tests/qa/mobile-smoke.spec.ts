import { expect, test } from "@playwright/test";

test("preview produção: navegação mobile em rede lenta sem erros", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8 });
  const errors: string[] = [], apiRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", request => errors.push(`${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
  page.on("response", response => { if (response.status() >= 400) errors.push(`${new URL(response.url()).pathname}: HTTP ${response.status()}`); });
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(new URL(request.url()).pathname); });
  await page.goto("/preview");
  await page.getByRole("link", { name: "Testar Booking", exact: true }).click();
  await expect(page).toHaveURL(/\/preview\/booking$/);
  await page.getByRole("radio", { name: /Corte \+ escova/ }).click();
  await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  await expect(page.getByRole("heading", { name: "Escolha o horário" })).toBeVisible();
  await page.getByRole("button", { name: /MODO PREVIEW/ }).click();
  await page.getByRole("link", { name: "Landing", exact: true }).click();
  await expect(page).toHaveURL(/\/preview\/landing$/);
  await expect(page.locator("#precos")).toContainText("R$ 49");
  await page.getByRole("button", { name: /MODO PREVIEW/ }).click();
  await page.getByRole("link", { name: "Hub", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hub de Preview/ })).toBeVisible();
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});
