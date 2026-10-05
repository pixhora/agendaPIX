# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-ui.spec.ts >> Pix: dinheiro recebido após expiração não confirma horário liberado
- Location: tests/qa/booking-ui.spec.ts:160:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Tempo de reserva esgotado' })
Expected: visible
Timeout: 2500ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Tempo de reserva esgotado' }) with timeout 2500ms
  - waiting for getByRole('heading', { name: 'Tempo de reserva esgotado' })

```

```yaml
- alert
- main:
  - text: ✓
  - heading "Horário confirmado!" [level=2]
  - paragraph: Seu agendamento na Salão QA foi garantido.
  - paragraph: Serviço reservado
  - paragraph: Corte QA
  - paragraph: "⏱ Duração: 30 min"
  - paragraph: Data
  - paragraph: domingo, 04 de outubro
  - paragraph: Horário
  - paragraph: 09:00
  - paragraph: Cliente
  - paragraph: Cliente QA
  - paragraph: (11) 99999-9999
  - text: "Valor total: R$ 50,00 Sinal pago no Pix: R$ 10,00 Restante no local: R$ 40,00"
  - link "💬 Notificar no WhatsApp":
    - /url: https://wa.me/?text=Ol%C3%A1%20Sal%C3%A3o%20QA!%20Acabei%20de%20agendar%20Corte%20QA%20para%20domingo%2C%2004%20de%20outubro%20%C3%A0s%2009%3A00%20no%20nome%20de%20Cliente%20QA.
  - button "Fazer outro agendamento"
```

# Test source

```ts
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
  152 |   await page.clock.runFor(2500);
  153 |   await expect(page.getByText("Não foi possível verificar no momento. Tentaremos novamente.")).toBeVisible();
  154 |   await expect(page.getByRole("heading", { name: "Tempo de reserva esgotado" })).not.toBeVisible();
  155 |   recovered = true;
  156 |   await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
  157 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
  158 | });
  159 | 
  160 | test("Pix: dinheiro recebido após expiração não confirma horário liberado", async ({ page }) => {
  161 |   await page.route(`**/api/public/${slug}/bookings/*/payment`, (route) => route.fulfill({ json: { ...booking, status: "expired", payment: { ...booking.payment, status: "paid", copyPaste: null, qrCodeDataUrl: null } } }));
  162 |   await payment(page);
  163 |   await page.getByRole("button", { name: "Já fiz o pagamento no banco" }).click();
> 164 |   await expect(page.getByRole("heading", { name: "Tempo de reserva esgotado" })).toBeVisible();
      |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  165 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).not.toBeVisible();
  166 | });
  167 | 
  168 | test("a11y: seta direita seleciona próximo serviço no radiogroup", async ({ page }) => {
  169 |   await page.route(`**/api/public/${slug}/services`, (route) => route.fulfill({ json: { ...business, services: [service, { ...service, id: "44444444-4444-4444-8444-444444444444", name: "Barba QA" }] } }));
  170 |   await page.goto(`/${slug}`);
  171 |   const first = page.getByRole("radio", { name: /Corte QA/ });
  172 |   await first.click();
  173 |   await first.press("ArrowRight");
  174 |   await expect(page.getByRole("radio", { name: /Barba QA/ })).toHaveAttribute("aria-checked", "true");
  175 | });
  176 | 
  177 | test("a11y: data escolhida tem estado selecionado acessível", async ({ page }) => {
  178 |   await chooseService(page);
  179 |   const today = page.getByRole("button", { name: /^Hoje/ });
  180 |   const announced = await today.evaluate((element) => element.getAttribute("aria-pressed") === "true" || element.getAttribute("aria-current") === "date" || element.getAttribute("aria-selected") === "true");
  181 |   expect(announced).toBe(true);
  182 | });
  183 | 
  184 | test("a11y: código Pix mostra foco de teclado", async ({ page }) => {
  185 |   await payment(page);
  186 |   const code = page.getByLabel("Código Pix Copia e Cola:");
  187 |   await code.focus();
  188 |   await code.press("Tab");
  189 |   await page.keyboard.press("Shift+Tab");
  190 |   const focus = await code.evaluate((element) => { const s = getComputedStyle(element); return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, shadow: s.boxShadow }; });
  191 |   expect(focus.outlineStyle !== "none" && parseFloat(focus.outlineWidth) > 0 || focus.shadow !== "none").toBe(true);
  192 | });
  193 | 
  194 | test("mobile e desktop: quatro passos sem overflow horizontal", async ({ page }) => {
  195 |   for (const width of [375, 768, 1280]) {
  196 |     await page.setViewportSize({ width, height: 812 });
  197 |     await payment(page);
  198 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  199 |     for (const button of await page.locator("main button").all()) {
  200 |       const box = await button.boundingBox();
  201 |       expect(box?.height).toBeGreaterThanOrEqual(44);
  202 |     }
  203 |   }
  204 | });
  205 | 
  206 | test("movimento reduzido e tokens próprios no modo escuro", async ({ page }) => {
  207 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  208 |   await chooseService(page);
  209 |   expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(14, 22, 18)");
  210 |   const transitions = await page.getByRole("button", { name: /^Hoje/ }).evaluate((element) => getComputedStyle(element).transitionDuration);
  211 |   expect(transitions.split(",").every((duration) => parseFloat(duration) <= 0.001)).toBe(true);
  212 | });
  213 | 
  214 | 
  215 | test("a11y: botão principal atende contraste AA no modo claro", async ({ page }) => {
  216 |   await chooseService(page);
  217 |   const button = page.getByRole("button", { name: "Preencher meus dados" });
  218 |   await page.getByRole("radio", { name: "09:00", exact: true }).click();
  219 |   const ratio = await button.evaluate((element) => {
  220 |     const style = getComputedStyle(element);
  221 |     const luminance = (color: string) => {
  222 |       const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  223 |       return channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  224 |     };
  225 |     const foreground = luminance(style.color), background = luminance(style.backgroundColor);
  226 |     return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  227 |   });
  228 |   expect(ratio).toBeGreaterThanOrEqual(4.5);
  229 | });
  230 | 
```