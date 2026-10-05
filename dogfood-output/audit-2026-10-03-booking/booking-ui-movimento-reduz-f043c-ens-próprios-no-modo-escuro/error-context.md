# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-ui.spec.ts >> movimento reduzido e tokens próprios no modo escuro
- Location: tests/qa/booking-ui.spec.ts:184:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "1e-05s"
Received: "0s"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]
  - main [ref=e12]:
    - generic [ref=e13]:
      - heading "Salão QA" [level=1] [ref=e14]
      - paragraph [ref=e15]: Agendamento online seguro
    - navigation "Etapas do agendamento" [ref=e16]:
      - list [ref=e17]:
        - listitem [ref=e18]:
          - generic [ref=e19]: ✓
          - generic [ref=e22]: Serviço
        - listitem [ref=e23]:
          - generic [ref=e24]: "2"
          - generic [ref=e28]: Horário
        - listitem [ref=e29]:
          - generic [ref=e30]: "3"
          - generic [ref=e34]: Dados
        - listitem [ref=e35]:
          - generic [ref=e36]: "4"
          - generic [ref=e39]: Pix
    - generic [ref=e41]:
      - generic [ref=e42]:
        - heading "Escolha o horário" [level=2] [ref=e43]
        - paragraph [ref=e44]: "Corte QA • Sinal: R$ 10,00"
      - region "Régua de datas disponíveis" [ref=e45]:
        - generic [ref=e46]:
          - button "Hoje 03/10 1 vaga" [pressed] [ref=e47]:
            - generic [ref=e48]: Hoje
            - generic [ref=e49]: 03/10
            - generic [ref=e50]: 1 vaga
          - button "Amanhã 04/10 1 vaga" [ref=e51]:
            - generic [ref=e52]: Amanhã
            - generic [ref=e53]: 04/10
            - generic [ref=e54]: 1 vaga
          - button "SEG 05/10 1 vaga" [ref=e55]:
            - generic [ref=e56]: SEG
            - generic [ref=e57]: 05/10
            - generic [ref=e58]: 1 vaga
          - button "TER 06/10 1 vaga" [ref=e59]:
            - generic [ref=e60]: TER
            - generic [ref=e61]: 06/10
            - generic [ref=e62]: 1 vaga
          - button "QUA 07/10 1 vaga" [ref=e63]:
            - generic [ref=e64]: QUA
            - generic [ref=e65]: 07/10
            - generic [ref=e66]: 1 vaga
          - button "QUI 08/10 1 vaga" [ref=e67]:
            - generic [ref=e68]: QUI
            - generic [ref=e69]: 08/10
            - generic [ref=e70]: 1 vaga
          - button "SEX 09/10 1 vaga" [ref=e71]:
            - generic [ref=e72]: SEX
            - generic [ref=e73]: 09/10
            - generic [ref=e74]: 1 vaga
      - region "Horários disponíveis no dia" [ref=e75]:
        - radiogroup "Horários disponíveis" [ref=e76]:
          - radio "09:00" [ref=e77]
      - generic [ref=e78]:
        - button "Voltar" [ref=e79] [cursor=pointer]
        - button "Selecione um horário" [disabled]
    - generic [ref=e80]: 🔒 Seus dados estão protegidos. Confirmação instantânea por Pix.
```

# Test source

```ts
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
  173 |   for (const width of [375, 1280]) {
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
> 189 |   expect(transitions).toBe("1e-05s");
      |                       ^ Error: expect(received).toBe(expected) // Object.is equality
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