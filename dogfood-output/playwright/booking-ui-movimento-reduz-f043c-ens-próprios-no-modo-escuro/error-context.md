# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-ui.spec.ts >> movimento reduzido e tokens próprios no modo escuro
- Location: tests/qa/booking-ui.spec.ts:206:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "rgb(14, 22, 18)"
Received: "rgb(15, 15, 16)"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]
  - main [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]: SQ
      - generic [ref=e15]:
        - heading "Salão QA" [level=1] [ref=e16]
        - paragraph [ref=e17]: Agendamento online oficial · Garantia por Pix
    - navigation "Etapas do agendamento" [ref=e19]:
      - list [ref=e20]:
        - listitem [ref=e21]:
          - generic [ref=e22]: ✓
          - generic [ref=e25]: Serviço
        - listitem [ref=e26]:
          - generic [ref=e27]: "2"
          - generic [ref=e31]: Horário
        - listitem [ref=e32]:
          - generic [ref=e33]: "3"
          - generic [ref=e37]: Dados
        - listitem [ref=e38]:
          - generic [ref=e39]: "4"
          - generic [ref=e42]: Pix
    - generic [ref=e44]:
      - generic [ref=e45]:
        - heading "Escolha o horário" [level=2] [ref=e46]
        - paragraph [ref=e47]: "Corte QA • Sinal: R$ 10,00"
      - region "Régua de datas disponíveis" [ref=e48]:
        - group "Selecione uma data" [ref=e50]:
          - button "Hoje 04/10 1 vaga" [pressed] [ref=e51]:
            - generic [ref=e52]: Hoje
            - generic [ref=e53]: 04/10
            - generic [ref=e54]: 1 vaga
          - button "Amanhã 05/10 1 vaga" [ref=e55]:
            - generic [ref=e56]: Amanhã
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
          - button "SÁB 10/10 1 vaga" [ref=e75]:
            - generic [ref=e76]: SÁB
            - generic [ref=e77]: 10/10
            - generic [ref=e78]: 1 vaga
      - region "Horários disponíveis no dia" [ref=e79]:
        - radiogroup "Horários disponíveis" [ref=e80]:
          - radio "09:00" [ref=e81]
      - generic [ref=e82]:
        - button "Voltar" [ref=e83] [cursor=pointer]
        - button "Selecione um horário" [disabled]
    - generic [ref=e84]: 🔒 Seus dados estão protegidos. Sinal antecipado para garantia do horário.
```

# Test source

```ts
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
  164 |   await expect(page.getByRole("heading", { name: "Tempo de reserva esgotado" })).toBeVisible();
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
> 209 |   expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(14, 22, 18)");
      |                                                                                      ^ Error: expect(received).toBe(expected) // Object.is equality
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
  231 | 
  232 | test("onboarding: restaura rascunho sem erro de hidratação e permite teclado", async ({ page }) => {
  233 |   const errors: string[] = [];
  234 |   page.on("pageerror", (error) => errors.push(error.message));
  235 |   page.on("console", (message) => {
  236 |     if (message.type() === "error") errors.push(message.text());
  237 |   });
  238 |   await page.addInitScript(() => {
  239 |     localStorage.setItem("agenda_onboarding_draft", JSON.stringify({ businessName: "Studio QA", slug: "studio-qa" }));
  240 |   });
  241 |   await page.goto("/onboarding");
  242 |   await expect(page.getByLabel("Nome do estabelecimento ou profissional")).toHaveValue("Studio QA");
  243 |   const next = page.getByRole("button", { name: "Continuar", exact: true });
  244 |   await expect(next).toBeEnabled();
  245 |   await next.focus();
  246 |   await page.keyboard.press("Enter");
  247 |   await expect(page.getByRole("heading", { name: /serviço/i })).toBeVisible();
  248 |   await page.reload();
  249 |   await expect(page.getByLabel("Nome do estabelecimento ou profissional")).toHaveValue("Studio QA");
  250 |   expect(errors.filter((error) => /hydrat|server rendered|didn't match/i.test(error))).toEqual([]);
  251 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  252 | });
  253 | 
```