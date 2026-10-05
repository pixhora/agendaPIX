# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-ui.spec.ts >> serviços: carregando, erro recuperável e sucesso
- Location: tests/qa/booking-ui.spec.ts:40:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Tentar novamente' })
Expected: visible
Timeout: 2500ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Tentar novamente' }) with timeout 2500ms
  - waiting for getByRole('button', { name: 'Tentar novamente' })

```

```yaml
- status: Carregando informações do estabelecimento...
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | 
  3   | const service = { id: "11111111-1111-4111-8111-111111111111", name: "Corte QA", durationMinutes: 30, priceCents: 5000, depositCents: 1000 };
  4   | const business = { name: "Salão QA", timezone: "America/Sao_Paulo", services: [service] };
  5   | const slug = "qa-mock";
  6   | const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  7   | const slot = { startsAt: `${date}T12:00:00.000Z`, endsAt: `${date}T12:30:00.000Z` };
  8   | const booking = {
  9   |   bookingId: "22222222-2222-4222-8222-222222222222", accessToken: "test-access-token",
  10  |   status: "pending_payment", ...slot, expiresAt: new Date(Date.now() + 900000).toISOString(),
  11  |   payment: { id: "33333333-3333-4333-8333-333333333333", provider: "fake", externalId: "fake_qa", amountCents: 1000, status: "pending", expiresAt: new Date(Date.now() + 900000).toISOString(), copyPaste: "FAKE-PIX-NOT-PAYABLE:fake_qa:1000", qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" },
  12  | };
  13  | 
  14  | async function mocks(page: Page) {
  15  |   await page.route(`**/api/public/${slug}/services`, (route) => route.fulfill({ json: business }));
  16  |   await page.route(`**/api/public/${slug}/availability?**`, (route) => route.fulfill({ json: { timezone: business.timezone, slots: [slot] } }));
  17  |   await page.route(`**/api/public/${slug}/bookings`, (route) => route.fulfill({ status: 201, json: booking }));
  18  |   await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill({ json: booking }));
  19  | }
  20  | async function chooseService(page: Page) {
  21  |   await page.goto(`/${slug}`);
  22  |   await page.getByRole("radio", { name: /Corte QA/ }).click();
  23  |   await page.getByRole("button", { name: "Continuar para escolher horário" }).click();
  24  | }
  25  | async function customer(page: Page) {
  26  |   await chooseService(page);
  27  |   await page.getByRole("radio", { name: "09:00", exact: true }).click();
  28  |   await page.getByRole("button", { name: "Preencher meus dados" }).click();
  29  | }
  30  | async function payment(page: Page) {
  31  |   await customer(page);
  32  |   await page.getByLabel("Nome completo").fill("Cliente QA");
  33  |   await page.getByLabel("WhatsApp para confirmação").fill("11999999999");
  34  |   await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  35  |   await expect(page.getByRole("heading", { name: "Pague o sinal por Pix" })).toBeVisible();
  36  | }
  37  | 
  38  | test.beforeEach(async ({ page }) => { await mocks(page); });
  39  | 
  40  | test("serviços: carregando, erro recuperável e sucesso", async ({ page }) => {
  41  |   let recovered = false;
  42  |   let release!: () => void;
  43  |   const pending = new Promise<void>((resolve) => { release = resolve; });
  44  |   await page.route(`**/api/public/${slug}/services`, async (route) => {
  45  |     await pending;
  46  |     await route.fulfill(recovered ? { json: business } : { status: 503, json: { error: { message: "indisponível" } } });
  47  |   });
  48  |   await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
  49  |   await expect(page.getByRole("status")).toContainText("Carregando informações");
  50  |   release();
> 51  |   await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
      |                                                                        ^ Error: expect(locator).toBeVisible() failed
  52  |   recovered = true;
  53  |   await page.getByRole("button", { name: "Tentar novamente" }).click();
  54  |   await expect(page.getByRole("heading", { name: "Escolha o serviço" })).toBeVisible();
  55  | });
  56  | 
  57  | test("serviços: vazio", async ({ page }) => {
  58  |   await page.route(`**/api/public/${slug}/services`, (route) => route.fulfill({ json: { ...business, services: [] } }));
  59  |   await page.goto(`/${slug}`);
  60  |   await expect(page.getByRole("heading", { name: "Nenhum serviço disponível" })).toBeVisible();
  61  | });
  62  | 
  63  | test("horários: tocar novamente no dia atual mantém grade utilizável", async ({ page }) => {
  64  |   await chooseService(page);
  65  |   await expect(page.getByRole("radio", { name: "09:00", exact: true })).toBeVisible();
  66  |   await page.getByRole("button", { name: /^Hoje/ }).click();
  67  |   await expect(page.getByRole("radio", { name: "09:00", exact: true })).toBeVisible();
  68  | });
  69  | 
  70  | test("horários: tentar novamente após falha consulta API e recupera grade", async ({ page }) => {
  71  |   let recovered = false;
  72  |   await page.route(`**/api/public/${slug}/availability?**`, (route) => route.fulfill(recovered ? { json: { timezone: business.timezone, slots: [slot] } } : { status: 503, json: { error: { message: "indisponível" } } }));
  73  |   await chooseService(page);
  74  |   await expect(page.getByText("Não foi possível carregar os horários.")).toBeVisible();
  75  |   recovered = true;
  76  |   await page.getByRole("button", { name: "Tentar novamente" }).click();
  77  |   await expect(page.getByRole("radio", { name: "09:00", exact: true })).toBeVisible();
  78  | });
  79  | 
  80  | test("horários: vazio orienta escolher outro dia", async ({ page }) => {
  81  |   await page.route(`**/api/public/${slug}/availability?**`, (route) => route.fulfill({ json: { timezone: business.timezone, slots: [] } }));
  82  |   await chooseService(page);
  83  |   await expect(page.getByText("Sem horários livres para este dia")).toBeVisible();
  84  |   await expect(page.getByRole("button", { name: "Selecione um horário" })).toBeDisabled();
  85  | });
  86  | 
  87  | test("dados: erros vinculados aos campos e máscara nacional", async ({ page }) => {
  88  |   await customer(page);
  89  |   await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  90  |   await expect(page.getByLabel("Nome completo")).toHaveAttribute("aria-invalid", "true");
  91  |   await expect(page.getByLabel("WhatsApp para confirmação")).toHaveAttribute("aria-describedby", "phone-error");
  92  |   await page.getByLabel("Nome completo").fill("Cliente QA");
  93  |   await page.getByLabel("WhatsApp para confirmação").fill("11999999999");
  94  |   await expect(page.getByLabel("WhatsApp para confirmação")).toHaveValue("(11) 99999-9999");
  95  | });
  96  | 
  97  | test("dados: colar telefone brasileiro com +55 preserva DDD e número", async ({ page }) => {
  98  |   await customer(page);
  99  |   await page.getByLabel("WhatsApp para confirmação").fill("+5511999999999");
  100 |   await expect(page.getByLabel("WhatsApp para confirmação")).toHaveValue("(11) 99999-9999");
  101 | });
  102 | 
  103 | test("dados: conflito de horário é explicado e permite voltar", async ({ page }) => {
  104 |   await page.route(`**/api/public/${slug}/bookings`, (route) => route.fulfill({ status: 409, json: { error: { code: "slot_unavailable", message: "Esse horário não está mais disponível." } } }));
  105 |   await customer(page);
  106 |   await page.getByLabel("Nome completo").fill("Cliente QA");
  107 |   await page.getByLabel("WhatsApp para confirmação").fill("11999999999");
  108 |   await page.getByRole("button", { name: /Pagar sinal de/ }).click();
  109 |   await expect(page.getByText("Esse horário não está mais disponível.")).toBeVisible();
  110 |   await page.getByRole("button", { name: "Voltar", exact: true }).click();
  111 |   await expect(page.getByRole("heading", { name: "Escolha o horário" })).toBeVisible();
  112 | });
  113 | 
  114 | test("Pix: simulação, QR, copia-e-cola e confirmação por polling", async ({ page, context }) => {
  115 |   await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  116 |   await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill({ json: { ...booking, status: "confirmed", payment: { ...booking.payment, status: "paid", copyPaste: null, qrCodeDataUrl: null } } }));
  117 |   await payment(page);
  118 |   await expect(page.getByRole("alert").filter({ hasText: "AMBIENTE DE TESTE" })).toContainText("Não envie dinheiro real");
  119 |   await expect(page.getByRole("img", { name: "QR Code do Pix simulado" })).toBeVisible();
  120 |   await page.getByRole("button", { name: "Copiar", exact: true }).click();
  121 |   await expect(page.getByRole("button", { name: "✓ Copiado!" })).toBeVisible();
  122 |   expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(booking.payment.copyPaste);
  123 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible({ timeout: 6000 });
  124 | });
  125 | 
  126 | test("Pix: falha de consulta exibe erro e nova tentativa confirma", async ({ page }) => {
  127 |   let recovered = false;
  128 |   await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill(recovered ? { json: { ...booking, status: "confirmed" } } : { status: 503, json: {} }));
  129 |   await payment(page);
  130 |   await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  131 |   await expect(page.getByText("Não foi possível verificar no momento. Tentaremos novamente.")).toBeVisible();
  132 |   recovered = true;
  133 |   await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  134 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
  135 | });
  136 | 
  137 | test("Pix: consulta confirmação antes de anunciar expiração local", async ({ page }) => {
  138 |   await page.clock.install();
  139 |   await page.route(`**/api/public/${slug}/bookings`, (route) => route.fulfill({ status: 201, json: { ...booking, expiresAt: new Date(Date.now() + 2000).toISOString(), payment: { ...booking.payment, expiresAt: new Date(Date.now() + 2000).toISOString() } } }));
  140 |   await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill({ json: { ...booking, status: "confirmed", payment: { ...booking.payment, status: "paid" } } }));
  141 |   await payment(page);
  142 |   await page.clock.runFor(6000);
  143 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
  144 | });
  145 | 
  146 | test("Pix: falha perto do vencimento preserva recuperação da confirmação", async ({ page }) => {
  147 |   await page.clock.install();
  148 |   let recovered = false;
  149 |   await page.route(`**/api/public/${slug}/bookings`, (route) => route.fulfill({ status: 201, json: { ...booking, expiresAt: new Date(Date.now() + 2000).toISOString(), payment: { ...booking.payment, expiresAt: new Date(Date.now() + 2000).toISOString() } } }));
  150 |   await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill(recovered ? { json: { ...booking, status: "confirmed" } } : { status: 503, json: {} }));
  151 |   await payment(page);
```