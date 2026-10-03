import { test, expect, type Page } from "@playwright/test";

const service = { id: "11111111-1111-4111-8111-111111111111", name: "Corte QA", durationMinutes: 30, priceCents: 5000, depositCents: 1000 };
const business = { name: "Salão QA", timezone: "America/Sao_Paulo", services: [service] };
const slug = "qa-mock";
const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const slot = { startsAt: `${date}T12:00:00.000Z`, endsAt: `${date}T12:30:00.000Z` };
const booking = {
  bookingId: "22222222-2222-4222-8222-222222222222", accessToken: "test-access-token",
  status: "pending_payment", ...slot, expiresAt: new Date(Date.now() + 900000).toISOString(),
  payment: { id: "33333333-3333-4333-8333-333333333333", provider: "fake", externalId: "fake_qa", amountCents: 1000, status: "pending", expiresAt: new Date(Date.now() + 900000).toISOString(), copyPaste: "FAKE-PIX-NOT-PAYABLE:fake_qa:1000", qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" },
};

async function mocks(page: Page) {
  await page.route(`**/api/public/${slug}/services`, (route) => route.fulfill({ json: business }));
  await page.route(`**/api/public/${slug}/availability?**`, (route) => route.fulfill({ json: { timezone: business.timezone, slots: [slot] } }));
  await page.route(`**/api/public/${slug}/bookings`, (route) => route.fulfill({ status: 201, json: booking }));
  await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill({ json: booking }));
}
async function chooseService(page: Page) {
  await page.goto(`/${slug}`);
  await page.getByRole("radio", { name: /Corte QA/ }).click();
  await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
}
async function customer(page: Page) {
  await chooseService(page);
  await page.getByRole("radio", { name: "09:00", exact: true }).click();
  await page.getByRole("button", { name: "Preencher meus dados" }).click();
}
async function payment(page: Page) {
  await customer(page);
  await page.getByLabel("Nome completo").fill("Cliente QA");
  await page.getByLabel("WhatsApp para confirmação").fill("11999999999");
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await mocks(page); });

test("serviços: carregando, erro recuperável e sucesso", async ({ page }) => {
  let recovered = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/public/${slug}/services`, async (route) => {
    await pending;
    await route.fulfill(recovered ? { json: business } : { status: 503, json: { error: { message: "indisponível" } } });
  });
  await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status")).toContainText("Carregando informações");
  release();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  recovered = true;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Escolha o serviço" })).toBeVisible();
});

test("serviços: vazio", async ({ page }) => {
  await page.route(`**/api/public/${slug}/services`, (route) => route.fulfill({ json: { ...business, services: [] } }));
  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { name: "Nenhum serviço disponível" })).toBeVisible();
});

test("horários: tocar novamente no dia atual mantém grade utilizável", async ({ page }) => {
  await chooseService(page);
  await expect(page.getByRole("radio", { name: "09:00", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Hoje/ }).click();
  await expect(page.getByRole("radio", { name: "09:00", exact: true })).toBeVisible();
});

test("horários: tentar novamente após falha consulta API e recupera grade", async ({ page }) => {
  let recovered = false;
  await page.route(`**/api/public/${slug}/availability?**`, (route) => route.fulfill(recovered ? { json: { timezone: business.timezone, slots: [slot] } } : { status: 503, json: { error: { message: "indisponível" } } }));
  await chooseService(page);
  await expect(page.getByText("Não foi possível carregar os horários.")).toBeVisible();
  recovered = true;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("radio", { name: "09:00", exact: true })).toBeVisible();
});

test("horários: vazio orienta escolher outro dia", async ({ page }) => {
  await page.route(`**/api/public/${slug}/availability?**`, (route) => route.fulfill({ json: { timezone: business.timezone, slots: [] } }));
  await chooseService(page);
  await expect(page.getByText("Sem horários livres para este dia")).toBeVisible();
  await expect(page.getByRole("button", { name: "Selecione um horário" })).toBeDisabled();
});

test("dados: erros vinculados aos campos e máscara nacional", async ({ page }) => {
  await customer(page);
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  await expect(page.getByLabel("Nome completo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("WhatsApp para confirmação")).toHaveAttribute("aria-describedby", "phone-error");
  await page.getByLabel("Nome completo").fill("Cliente QA");
  await page.getByLabel("WhatsApp para confirmação").fill("11999999999");
  await expect(page.getByLabel("WhatsApp para confirmação")).toHaveValue("(11) 99999-9999");
});

test("dados: colar telefone brasileiro com +55 preserva DDD e número", async ({ page }) => {
  await customer(page);
  await page.getByLabel("WhatsApp para confirmação").fill("+5511999999999");
  await expect(page.getByLabel("WhatsApp para confirmação")).toHaveValue("(11) 99999-9999");
});

test("dados: conflito de horário é explicado e permite voltar", async ({ page }) => {
  await page.route(`**/api/public/${slug}/bookings`, (route) => route.fulfill({ status: 409, json: { error: { code: "slot_unavailable", message: "Esse horário não está mais disponível." } } }));
  await customer(page);
  await page.getByLabel("Nome completo").fill("Cliente QA");
  await page.getByLabel("WhatsApp para confirmação").fill("11999999999");
  await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  await expect(page.getByText("Esse horário não está mais disponível.")).toBeVisible();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Escolha o horário" })).toBeVisible();
});

test("Pix: simulação, QR, copia-e-cola e confirmação por polling", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill({ json: { ...booking, status: "confirmed", payment: { ...booking.payment, status: "paid", copyPaste: null, qrCodeDataUrl: null } } }));
  await payment(page);
  await expect(page.getByRole("alert").filter({ hasText: "AMBIENTE DE TESTE" })).toContainText("Não envie dinheiro real");
  await expect(page.getByRole("img", { name: "QR Code do Pix simulado" })).toBeVisible();
  await page.getByRole("button", { name: "Copiar", exact: true }).click();
  await expect(page.getByRole("button", { name: "✓ Copiado!" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(booking.payment.copyPaste);
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible({ timeout: 6000 });
});

test("Pix: falha de consulta exibe erro e nova tentativa confirma", async ({ page }) => {
  let recovered = false;
  await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill(recovered ? { json: { ...booking, status: "confirmed" } } : { status: 503, json: {} }));
  await payment(page);
  await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  await expect(page.getByText("Não foi possível verificar no momento. Tentaremos novamente.")).toBeVisible();
  recovered = true;
  await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
});

test("Pix: consulta confirmação antes de anunciar expiração local", async ({ page }) => {
  await page.clock.install();
  await page.route(`**/api/public/${slug}/bookings`, (route) => route.fulfill({ status: 201, json: { ...booking, expiresAt: new Date(Date.now() + 2000).toISOString(), payment: { ...booking.payment, expiresAt: new Date(Date.now() + 2000).toISOString() } } }));
  await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill({ json: { ...booking, status: "confirmed", payment: { ...booking.payment, status: "paid" } } }));
  await payment(page);
  await page.clock.runFor(6000);
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
});

test("Pix: falha perto do vencimento preserva recuperação da confirmação", async ({ page }) => {
  await page.clock.install();
  let recovered = false;
  await page.route(`**/api/public/${slug}/bookings`, (route) => route.fulfill({ status: 201, json: { ...booking, expiresAt: new Date(Date.now() + 2000).toISOString(), payment: { ...booking.payment, expiresAt: new Date(Date.now() + 2000).toISOString() } } }));
  await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill(recovered ? { json: { ...booking, status: "confirmed" } } : { status: 503, json: {} }));
  await payment(page);
  await page.clock.runFor(2500);
  await expect(page.getByText("Não foi possível verificar no momento. Tentaremos novamente.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tempo de reserva esgotado" })).not.toBeVisible();
  recovered = true;
  await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
});

test("Pix: dinheiro recebido após expiração não confirma horário liberado", async ({ page }) => {
  await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill({ json: { ...booking, status: "expired", payment: { ...booking.payment, status: "paid", copyPaste: null, qrCodeDataUrl: null } } }));
  await payment(page);
  await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  await expect(page.getByRole("heading", { name: "Tempo de reserva esgotado" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Horário confirmado!" })).not.toBeVisible();
});

test("a11y: seta direita seleciona próximo serviço no radiogroup", async ({ page }) => {
  await page.route(`**/api/public/${slug}/services`, (route) => route.fulfill({ json: { ...business, services: [service, { ...service, id: "44444444-4444-4444-8444-444444444444", name: "Barba QA" }] } }));
  await page.goto(`/${slug}`);
  const first = page.getByRole("radio", { name: /Corte QA/ });
  await first.click();
  await first.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /Barba QA/ })).toHaveAttribute("aria-checked", "true");
});

test("a11y: data escolhida tem estado selecionado acessível", async ({ page }) => {
  await chooseService(page);
  const today = page.getByRole("button", { name: /^Hoje/ });
  const announced = await today.evaluate((element) => element.getAttribute("aria-pressed") === "true" || element.getAttribute("aria-current") === "date" || element.getAttribute("aria-selected") === "true");
  expect(announced).toBe(true);
});

test("a11y: código Pix mostra foco de teclado", async ({ page }) => {
  await payment(page);
  const code = page.getByLabel("Código Pix Copia e Cola:");
  await code.focus();
  await code.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const focus = await code.evaluate((element) => { const s = getComputedStyle(element); return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, shadow: s.boxShadow }; });
  expect(focus.outlineStyle !== "none" && parseFloat(focus.outlineWidth) > 0 || focus.shadow !== "none").toBe(true);
});

test("mobile e desktop: quatro passos sem overflow horizontal", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await payment(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await page.locator("main button").all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("movimento reduzido e tokens próprios no modo escuro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await chooseService(page);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(14, 22, 18)");
  const transitions = await page.getByRole("button", { name: /^Hoje/ }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transitions.split(",").every((duration) => parseFloat(duration) <= 0.001)).toBe(true);
});


test("a11y: botão principal atende contraste AA no modo claro", async ({ page }) => {
  await chooseService(page);
  const button = page.getByRole("button", { name: "Preencher meus dados" });
  await page.getByRole("radio", { name: "09:00", exact: true }).click();
  const ratio = await button.evaluate((element) => {
    const style = getComputedStyle(element);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    };
    const foreground = luminance(style.color), background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});


test("onboarding: restaura rascunho sem erro de hidratação e permite teclado", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem("agenda_onboarding_draft", JSON.stringify({ businessName: "Studio QA", slug: "studio-qa" }));
  });
  await page.goto("/onboarding");
  await expect(page.getByLabel("Nome do estabelecimento ou profissional")).toHaveValue("Studio QA");
  const next = page.getByRole("button", { name: "Continuar", exact: true });
  await expect(next).toBeEnabled();
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /serviço/i })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nome do estabelecimento ou profissional")).toHaveValue("Studio QA");
  expect(errors.filter((error) => /hydrat|server rendered|didn't match/i.test(error))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
