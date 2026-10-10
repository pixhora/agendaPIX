import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.use({ storageState: "tests/e2e/.auth/owner.json" });

test("produção: slug antigo responde 308 no proxy e o cache negativo não gruda", async ({ page, baseURL }) => {
  const slug = `e2e-prod-${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const created = await page.request.post("/api/onboarding", {
    headers: {
      origin: baseURL ?? "",
      "idempotency-key": randomUUID(),
    },
    data: {
      business: { name: "Loja Prod", slug, timezone: "America/Sao_Paulo" },
      service: { name: "Corte", durationMinutes: 30, priceCents: 5000, depositCents: 0 },
      hours: [{ weekday: 1, opensAt: "09:00", closesAt: "18:00" }],
    },
  });
  const createdRaw = await created.text();
  expect(created.status(), createdRaw).toBe(201);
  const body = JSON.parse(createdRaw) as { businessId: string };

  const current = await page.request.get(`/${slug}`, { maxRedirects: 0 });
  expect(current.status()).toBe(200);

  const next = `${slug}-b`;
  const patched = await page.request.patch(`/api/businesses/${body.businessId}/profile`, {
    headers: { origin: baseURL ?? "" },
    data: { slug: next },
  });
  expect(patched.status(), await patched.text()).toBe(200);

  const moved = await page.request.get(`/${slug}?ref=wa`, { maxRedirects: 0 });
  expect(moved.status()).toBe(308);
  const location = moved.headers().location ?? "";
  expect(location).toContain(`/${next}`);
  expect(location).toContain("ref=wa");
  expect(moved.headers()["content-security-policy"] ?? "").toContain("frame-ancestors 'none'");
  expect(moved.headers()["cache-control"]).toContain("no-store");

  const planted = await page.request.get(`/${next}`, { maxRedirects: 0 });
  expect(planted.status()).toBe(200);

  const third = `${slug}-c`;
  const again = await page.request.patch(`/api/businesses/${body.businessId}/profile`, {
    headers: { origin: baseURL ?? "" },
    data: { slug: third },
  });
  expect(again.status(), await again.text()).toBe(200);

  const movedAgain = await page.request.get(`/${next}?ref=wa`, { maxRedirects: 0 });
  expect(movedAgain.status()).toBe(308);
  const locationAgain = movedAgain.headers().location ?? "";
  expect(locationAgain).toContain(`/${third}`);
  expect(locationAgain).toContain("ref=wa");
  expect(movedAgain.headers()["content-security-policy"] ?? "").toContain("frame-ancestors 'none'");
  expect(movedAgain.headers()["cache-control"]).toContain("no-store");
});
