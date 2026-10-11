import { expect } from "@playwright/test";
import { readMeta, test } from "./helpers";
import { pixResumePayload, pixResumeStorageKey } from "../../components/booking/pix-resume";

const meta = readMeta();
const bookingId = "00000000-0000-4000-8000-0000000000c1";

test.use({ storageState: { cookies: [], origins: [] } });

test("recarregar no meio do Pix com erro de rede não apaga a reserva", async ({ page }) => {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const payload = pixResumePayload({
    bookingId,
    accessToken: "token-e2e",
    expiresAt,
    serviceId: "00000000-0000-4000-8000-0000000000c2",
  });
  await page.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, value);
  }, { key: pixResumeStorageKey(meta.businessASlug), value: payload });
  await page.route("**/api/public/**/bookings/**/payment", (route) => route.abort("failed"));
  await page.goto(`/${meta.businessASlug}?bookingId=${bookingId}`);
  await expect(page.getByRole("heading", { name: "Não conseguimos carregar seu Pix" })).toBeVisible();
  await expect(page.getByText("Sua reserva continua guardada. Verifique sua internet e tente de novo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: /Serviços/ })).toHaveCount(0);
  const stored = await page.evaluate((key) => sessionStorage.getItem(key), pixResumeStorageKey(meta.businessASlug));
  expect(stored).toContain(bookingId);
  expect(page.url()).toContain(`bookingId=${encodeURIComponent(bookingId)}`);
});
