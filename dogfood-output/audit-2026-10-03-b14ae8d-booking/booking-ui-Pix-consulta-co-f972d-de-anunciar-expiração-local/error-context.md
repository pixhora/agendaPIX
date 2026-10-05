# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-ui.spec.ts >> Pix: consulta confirmação antes de anunciar expiração local
- Location: tests/qa/booking-ui.spec.ts:137:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Horário confirmado!' })
Expected: visible
Timeout: 2500ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Horário confirmado!' }) with timeout 2500ms
  - waiting for getByRole('heading', { name: 'Horário confirmado!' })

```

```yaml
- alert
- main:
  - heading "Salão QA" [level=1]
  - paragraph: Agendamento online seguro
  - navigation "Etapas do agendamento":
    - list:
      - listitem: ✓ Serviço
      - listitem: ✓ Horário
      - listitem: ✓ Dados
      - listitem: 4 Pix
  - heading "Tempo de reserva esgotado" [level=2]
  - paragraph: O prazo para pagamento do sinal de 15 minutos expirou e o horário foi liberado para outros clientes.
  - button "Fazer novo agendamento"
  - text: 🔒 Seus dados estão protegidos. Confirmação instantânea por Pix.
```

# Test source

```ts
  43  |   const pending = new Promise<void>((resolve) => { release = resolve; });
  44  |   await page.route(`**/api/public/${slug}/services`, async (route) => {
  45  |     await pending;
  46  |     await route.fulfill(recovered ? { json: business } : { status: 503, json: { error: { message: "indisponível" } } });
  47  |   });
  48  |   await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
  49  |   await expect(page.getByRole("status")).toContainText("Carregando informações");
  50  |   release();
  51  |   await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
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
> 143 |   await expect(page.getByRole("heading", { name: "Horário confirmado!" })).toBeVisible();
      |                                                                            ^ Error: expect(locator).toBeVisible() failed
  144 | });
  145 | 
  146 | test("a11y: seta direita seleciona próximo serviço no radiogroup", async ({ page }) => {
  147 |   await page.route(`**/api/public/${slug}/services`, (route) => route.fulfill({ json: { ...business, services: [service, { ...service, id: "44444444-4444-4444-8444-444444444444", name: "Barba QA" }] } }));
  148 |   await page.goto(`/${slug}`);
  149 |   const first = page.getByRole("radio", { name: /Corte QA/ });
  150 |   await first.click();
  151 |   await first.press("ArrowRight");
  152 |   await expect(page.getByRole("radio", { name: /Barba QA/ })).toHaveAttribute("aria-checked", "true");
  153 | });
  154 | 
  155 | test("a11y: data escolhida tem estado selecionado acessível", async ({ page }) => {
  156 |   await chooseService(page);
  157 |   const today = page.getByRole("button", { name: /^Hoje/ });
  158 |   const announced = await today.evaluate((element) => element.getAttribute("aria-pressed") === "true" || element.getAttribute("aria-current") === "date" || element.getAttribute("aria-selected") === "true");
  159 |   expect(announced).toBe(true);
  160 | });
  161 | 
  162 | test("a11y: código Pix mostra foco de teclado", async ({ page }) => {
  163 |   await payment(page);
  164 |   const code = page.getByLabel("Código Pix Copia e Cola:");
  165 |   await code.focus();
  166 |   await code.press("Tab");
  167 |   await page.keyboard.press("Shift+Tab");
  168 |   const focus = await code.evaluate((element) => { const s = getComputedStyle(element); return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, shadow: s.boxShadow }; });
  169 |   expect(focus.outlineStyle !== "none" && parseFloat(focus.outlineWidth) > 0 || focus.shadow !== "none").toBe(true);
  170 | });
  171 | 
  172 | test("mobile e desktop: quatro passos sem overflow horizontal", async ({ page }) => {
  173 |   for (const width of [375, 768, 1280]) {
  174 |     await page.setViewportSize({ width, height: 812 });
  175 |     await payment(page);
  176 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  177 |     for (const button of await page.locator("main button").all()) {
  178 |       const box = await button.boundingBox();
  179 |       expect(box?.height).toBeGreaterThanOrEqual(44);
  180 |     }
  181 |   }
  182 | });
  183 | 
  184 | test("movimento reduzido e tokens próprios no modo escuro", async ({ page }) => {
  185 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  186 |   await chooseService(page);
  187 |   expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(14, 22, 18)");
  188 |   const transitions = await page.getByRole("button", { name: /^Hoje/ }).evaluate((element) => getComputedStyle(element).transitionDuration);
  189 |   expect(transitions.split(",").every((duration) => parseFloat(duration) <= 0.001)).toBe(true);
  190 | });
  191 | 
  192 | 
  193 | test("a11y: botão principal atende contraste AA no modo claro", async ({ page }) => {
  194 |   await chooseService(page);
  195 |   const button = page.getByRole("button", { name: "Preencher meus dados" });
  196 |   await page.getByRole("radio", { name: "09:00", exact: true }).click();
  197 |   const ratio = await button.evaluate((element) => {
  198 |     const style = getComputedStyle(element);
  199 |     const luminance = (color: string) => {
  200 |       const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  201 |       return channels.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  202 |     };
  203 |     const foreground = luminance(style.color), background = luminance(style.backgroundColor);
  204 |     return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  205 |   });
  206 |   expect(ratio).toBeGreaterThanOrEqual(4.5);
  207 | });
  208 | 
```