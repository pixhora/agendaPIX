import { expect, test } from "@playwright/test";

test("esqueleto abre no celular e responde à verificação de saúde", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});


test("autenticação rejeita email inválido e não revela sessão inexistente", async ({ request }) => {
  const session = await request.get("/api/auth/get-session");
  expect(session.ok()).toBe(true);
  expect(await session.json()).toBeNull();
  const invalid = await request.post("/api/auth/sign-in/magic-link", {
    headers: { origin: "http://127.0.0.1:3103" },
    data: { email: "email-inválido", callbackURL: "/" },
  });
  expect(invalid.status()).toBe(400);
});
