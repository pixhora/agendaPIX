# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: preview-visual.spec.ts >> nova direção: contraste do hero escuro e CTA mobile
- Location: tests/qa/preview-visual.spec.ts:36:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 3
Received:    1.0051048919135304
```

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 44
Received:    36
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "A AgendaPix Preview" [ref=e6] [cursor=pointer]:
          - /url: /preview
          - generic [ref=e7]: A
          - generic [ref=e8]: AgendaPix
          - generic [ref=e9]: Preview
        - link "Testar Booking" [active] [ref=e11] [cursor=pointer]:
          - /url: /preview/booking
    - main [ref=e12]:
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Agenda online com cobrança de sinal por Pix
          - heading "Sua agenda no piloto automático com sinal por Pix." [level=1] [ref=e20]
          - paragraph [ref=e21]: Envie seu link no WhatsApp ou Instagram. Seu cliente escolhe o serviço e o horário sozinho e garante a vaga pagando o sinal no Pix. Acabe com o prejuízo de horários vazios.
          - generic [ref=e22]:
            - link "Começar teste grátis de 7 dias" [ref=e23] [cursor=pointer]:
              - /url: /onboarding
            - link "▶ Ver demonstração ao vivo" [ref=e24] [cursor=pointer]:
              - /url: "#demonstracao"
              - generic [ref=e25]: ▶
              - text: Ver demonstração ao vivo
          - generic [ref=e26]:
            - generic [ref=e27]:
              - strong [ref=e28]: ✓
              - text: Sem cartão de crédito
            - generic [ref=e29]:
              - strong [ref=e30]: ✓
              - text: Ativação em 3 minutos
            - generic [ref=e31]:
              - strong [ref=e32]: ✓
              - text: Cancele quando quiser
          - generic [ref=e33]:
            - paragraph [ref=e34]: "Feito para quem vive de atendimento:"
            - generic [ref=e35]:
              - generic [ref=e36]: Barbearias
              - generic [ref=e37]: Salões de Beleza
              - generic [ref=e38]: Clínicas
              - generic [ref=e39]: Manicures
              - generic [ref=e40]: Personal Trainers
              - generic [ref=e41]: Estúdios
        - generic [ref=e44]:
          - generic [ref=e45]:
            - generic [ref=e46]:
              - generic [ref=e47]: Sinais no Pix
              - generic [ref=e48]: +100% pago
            - generic [ref=e55]:
              - generic [ref=e56]: Hoje
              - generic [ref=e57]: R$ 105,00
          - generic [ref=e58]:
            - generic [ref=e59]: Pix Instantâneo
            - generic [ref=e65]:
              - paragraph [ref=e66]: Sinal garantido
              - paragraph [ref=e67]: R$ 30,00
            - generic [ref=e68]:
              - generic [ref=e69]:
                - paragraph [ref=e70]: Cliente
                - paragraph [ref=e71]: Bianca Taylor
              - generic [ref=e72]:
                - paragraph [ref=e73]: Horário
                - paragraph [ref=e74]: Hoje · 14h30
          - generic [ref=e75]:
            - generic [ref=e76]:
              - generic [ref=e77]: Próximo na Agenda
              - generic [ref=e80]: Corte + Barba
            - paragraph [ref=e81]: Carlos Eduardo
            - paragraph [ref=e82]: 15:30 — 16:30
            - generic [ref=e83]:
              - generic [ref=e84]: "Restante no local:"
              - generic [ref=e85]: R$ 50,00
          - generic [ref=e86]: Vaga confirmada
      - generic [ref=e90]:
        - paragraph [ref=e91]: Concebido para profissionais e pequenos negócios em todo o Brasil
        - generic [ref=e92]:
          - generic [ref=e93]:
            - paragraph [ref=e94]: Barbearias
            - paragraph [ref=e95]: Corte, barba e química
          - generic [ref=e96]:
            - paragraph [ref=e97]: Salões de Beleza
            - paragraph [ref=e98]: Cabelo, mechas e escova
          - generic [ref=e99]:
            - paragraph [ref=e100]: Clínicas & Estética
            - paragraph [ref=e101]: Procedimentos e massagens
          - generic [ref=e102]:
            - paragraph [ref=e103]: Manicures & Nail Designers
            - paragraph [ref=e104]: Alongamento e esmaltação
          - generic [ref=e105]:
            - paragraph [ref=e106]: Personal Trainers
            - paragraph [ref=e107]: Aulas e consultorias
      - generic [ref=e109]:
        - generic [ref=e110]:
          - generic [ref=e111]:
            - generic [ref=e112]: Vantagens
            - heading "Elimine o prejuízo de horários vazios e recupere seu tempo com uma plataforma feita para o Brasil." [level=2] [ref=e113]
          - paragraph [ref=e114]: Tudo o que você precisa, sem complicação.
        - generic [ref=e115]:
          - generic [ref=e116]:
            - generic [ref=e117]: ⚡
            - generic [ref=e118]:
              - generic [ref=e119]:
                - paragraph [ref=e120]: ✓ Notificação no celular
                - paragraph [ref=e121]: “Pix de R$ 30 recebido. Vaga das 14h garantida!”
              - heading "Zero perda de tempo" [level=3] [ref=e122]
              - paragraph [ref=e123]: Você não precisa abrir o app do banco toda hora para checar se o comprovante é verdadeiro.
          - generic [ref=e124]:
            - generic [ref=e125]:
              - generic [ref=e126]: "01"
              - generic [ref=e127]: Compromisso
            - generic [ref=e128]:
              - heading "Sinal Automático no Pix" [level=3] [ref=e129]
              - paragraph [ref=e130]: O cliente paga uma entrada no ato do agendamento. Se ele comparecer, abate do total. Se ele faltar sem avisar, seu horário já está pago.
          - generic [ref=e131]:
            - generic [ref=e132]:
              - generic [ref=e133]: "02"
              - generic [ref=e134]: 24h por dia
            - generic [ref=e135]:
              - heading "Sem Conversa Fiada no WhatsApp" [level=3] [ref=e136]
              - paragraph [ref=e137]: Chega de trocar 15 mensagens para marcar um corte. O cliente abre seu link, vê as vagas em tempo real e fecha em 4 passos.
          - generic [ref=e138]:
            - generic [ref=e139]:
              - generic [ref=e140]: "03"
              - generic [ref=e141]: Controle
            - generic [ref=e142]:
              - heading "Controle do Dia em Centavos" [level=3] [ref=e143]
              - paragraph [ref=e144]: Saiba exatamente quanto já entrou em sinal por Pix e quanto resta a receber no atendimento presencial. Sem surpresas no caixa.
      - generic [ref=e148]:
        - generic [ref=e150]:
          - generic [ref=e151]:
            - generic [ref=e152]: Studio Bella · SP
            - generic [ref=e155]: Pix Ligado
          - generic [ref=e156]:
            - paragraph [ref=e157]: Sinais Recebidos Hoje
            - paragraph [ref=e158]: R$ 370,00
            - paragraph [ref=e159]: ↑ 100% de presença confirmada
          - generic [ref=e160]:
            - generic [ref=e161]:
              - paragraph [ref=e162]: Agendados
              - paragraph [ref=e163]: 8 vagas
            - generic [ref=e164]:
              - paragraph [ref=e165]: No-show
              - paragraph [ref=e166]: 0 faltas
            - generic [ref=e167]:
              - paragraph [ref=e168]: Restante
              - paragraph [ref=e169]: R$ 510
          - generic [ref=e170]:
            - generic [ref=e171]: "Fuso oficial:"
            - generic [ref=e172]: America/Sao_Paulo
        - generic [ref=e173]:
          - generic [ref=e174]: Simplicidade Total
          - heading "Receba sinal por Pix em 3 passos simples" [level=2] [ref=e175]
          - generic [ref=e176]:
            - generic [ref=e177]:
              - generic [ref=e178]: "01"
              - generic [ref=e179]:
                - heading "Cadastre seus serviços em 3 minutos" [level=3] [ref=e180]
                - paragraph [ref=e181]: Defina o nome, a duração do procedimento e quanto quer cobrar de sinal por Pix para segurar a vaga.
            - generic [ref=e182]:
              - generic [ref=e183]: "02"
              - generic [ref=e184]:
                - heading "Coloque o link na bio e no WhatsApp" [level=3] [ref=e185]
                - paragraph [ref=e186]: Seus clientes acessam o link direto do celular, sem precisar instalar nenhum aplicativo.
            - generic [ref=e187]:
              - generic [ref=e188]: "03"
              - generic [ref=e189]:
                - heading "O cliente agenda e o Pix cai direto" [level=3] [ref=e190]
                - paragraph [ref=e191]: O horário só é bloqueado após o Pix ser confirmado. Menos mensagens, zero calote.
          - link "Criar minha agenda agora" [ref=e193] [cursor=pointer]:
            - /url: /onboarding
      - generic [ref=e195]:
        - generic [ref=e196]:
          - text: Demonstração em 4 passos
          - heading "Veja exatamente como seu cliente agenda no celular" [level=2] [ref=e197]
          - paragraph [ref=e198]: "Uma interface pensada para quem está na correria do dia a dia: limpa, veloz e sem atritos."
        - generic [ref=e199]:
          - generic [ref=e200]:
            - button "1 1. Escolha do serviço O cliente vê o tempo de duração e o valor do sinal no Pix com total clareza." [ref=e201]:
              - generic [ref=e202]:
                - generic [ref=e203]: "1"
                - generic [ref=e204]:
                  - heading "1. Escolha do serviço" [level=3] [ref=e205]
                  - paragraph [ref=e206]: O cliente vê o tempo de duração e o valor do sinal no Pix com total clareza.
            - button "2 2. Régua tátil de horários Vê quantos horários restam para hoje e amanhã e escolhe a melhor vaga com 1 toque." [ref=e207]:
              - generic [ref=e208]:
                - generic [ref=e209]: "2"
                - generic [ref=e210]:
                  - heading "2. Régua tátil de horários" [level=3] [ref=e211]
                  - paragraph [ref=e212]: Vê quantos horários restam para hoje e amanhã e escolhe a melhor vaga com 1 toque.
            - button "3 3. Nome e WhatsApp Preenchimento rápido e direto, sem senhas complicadas nem cadastros longos." [ref=e213]:
              - generic [ref=e214]:
                - generic [ref=e215]: "3"
                - generic [ref=e216]:
                  - heading "3. Nome e WhatsApp" [level=3] [ref=e217]
                  - paragraph [ref=e218]: Preenchimento rápido e direto, sem senhas complicadas nem cadastros longos.
            - button "4 4. Sinal pago por Pix QR Code imediato com 15 minutos para pagar. Confirmou, a vaga é dele." [ref=e219]:
              - generic [ref=e220]:
                - generic [ref=e221]: "4"
                - generic [ref=e222]:
                  - heading "4. Sinal pago por Pix" [level=3] [ref=e223]
                  - paragraph [ref=e224]: QR Code imediato com 15 minutos para pagar. Confirmou, a vaga é dele.
            - link "Criar minha agenda agora" [ref=e226] [cursor=pointer]:
              - /url: /onboarding
          - generic [ref=e228]:
            - generic [ref=e230]:
              - paragraph [ref=e231]: Barbearia Modelo
              - paragraph [ref=e232]: Agendamento online seguro
            - generic [ref=e234]:
              - paragraph [ref=e235]: "Escolha o serviço:"
              - generic [ref=e236]:
                - generic [ref=e237]:
                  - generic [ref=e238]: Corte + Barba
                  - generic [ref=e239]: Sinal R$ 20,00
                - paragraph [ref=e240]: ⏱ 50 min • Total R$ 70,00
              - generic [ref=e241]:
                - generic [ref=e242]:
                  - generic [ref=e243]: Corte Tradicional
                  - generic [ref=e244]: Sinal R$ 15,00
                - paragraph [ref=e245]: ⏱ 30 min • Total R$ 45,00
            - generic [ref=e246]: 🔒 Confirmação automática via Pix
      - generic [ref=e248]:
        - generic [ref=e249]:
          - generic [ref=e250]: Comparativo Real
          - heading "Você perde clientes e dinheiro quando a reserva depende de conversa manual" [level=2] [ref=e251]
        - generic [ref=e252]:
          - generic [ref=e253]:
            - generic [ref=e254]:
              - generic [ref=e255]: ✕
              - heading "Como você perde dinheiro hoje" [level=3] [ref=e256]
            - list [ref=e257]:
              - listitem [ref=e258]:
                - generic [ref=e259]: •
                - generic [ref=e260]:
                  - strong [ref=e261]: "Cliente marca e não aparece:"
                  - text: você reserva a vaga na confiança, recusa outros atendimentos e toma calote sem receber um centavo.
              - listitem [ref=e262]:
                - generic [ref=e263]: •
                - generic [ref=e264]:
                  - strong [ref=e265]: "Horas perdidas no WhatsApp:"
                  - text: passar valores um por um, checar agenda no papel e tentar conciliar horários à noite.
              - listitem [ref=e266]:
                - generic [ref=e267]: •
                - generic [ref=e268]:
                  - strong [ref=e269]: "Desconforto de cobrar sinal:"
                  - text: passar sua chave Pix pessoal, esperar o comprovante e conferir extrato enquanto atende.
          - generic [ref=e270]:
            - generic [ref=e271]:
              - generic [ref=e272]: ✓
              - heading "Com a Agenda Pix no Piloto Automático" [level=3] [ref=e273]
            - list [ref=e274]:
              - listitem [ref=e275]:
                - generic [ref=e276]: •
                - generic [ref=e277]:
                  - strong [ref=e278]: "Sinal no Pix garante o compromisso:"
                  - text: o cliente paga uma entrada no Pix na hora. Quem paga o sinal não falta.
              - listitem [ref=e279]:
                - generic [ref=e280]: •
                - generic [ref=e281]:
                  - strong [ref=e282]: "Agendamento em 1 minuto:"
                  - text: link público na bio do Instagram ou fixado no WhatsApp. O cliente agenda em 4 toques rápidos.
              - listitem [ref=e283]:
                - generic [ref=e284]: •
                - generic [ref=e285]:
                  - strong [ref=e286]: "Confirmação 100% automática:"
                  - text: sistema gera o QR Code com 15 min de prazo e libera a vaga se não for pago.
      - generic [ref=e288]:
        - generic [ref=e289]:
          - generic [ref=e290]: Preços Transparentes
          - heading "Invista menos de 1 atendimento por mês e pare de perder horários" [level=2] [ref=e291]
          - paragraph [ref=e292]: 7 dias de teste grátis sem cartão de crédito. Se o seu faturamento não aumentar com o sinal no Pix, não paga nada.
        - generic [ref=e293]:
          - generic [ref=e294]:
            - generic [ref=e295]:
              - generic [ref=e296]:
                - generic [ref=e297]: Autônomos e Iniciantes
                - heading "Plano Base" [level=3] [ref=e298]
                - paragraph [ref=e299]: Para profissional que atende sozinho e quer parar de tomar calote de clientes.
              - generic [ref=e300]:
                - generic [ref=e301]: R$ 29
                - generic [ref=e302]: / mês
              - list [ref=e303]:
                - listitem [ref=e304]:
                  - generic [ref=e305]: ✓
                  - generic [ref=e306]: 1 profissional / 1 agenda
                - listitem [ref=e307]:
                  - generic [ref=e308]: ✓
                  - generic [ref=e309]: Agendamentos ilimitados no mês
                - listitem [ref=e310]:
                  - generic [ref=e311]: ✓
                  - generic [ref=e312]: Cobrança de sinal Pix automático
                - listitem [ref=e313]:
                  - generic [ref=e314]: ✓
                  - generic [ref=e315]: Link com confirmação no WhatsApp
                - listitem [ref=e316]:
                  - generic [ref=e317]: ✓
                  - generic [ref=e318]: Régua de horários otimizada para celular
            - link "Começar teste de 7 dias" [ref=e320] [cursor=pointer]:
              - /url: /onboarding?plano=base
          - generic [ref=e321]:
            - generic [ref=e322]: Mais Escolhido
            - generic [ref=e323]:
              - generic [ref=e324]:
                - generic [ref=e325]: Crescimento e Estabelecimentos
                - heading "Plano Completo" [level=3] [ref=e326]
                - paragraph [ref=e327]: Para quem quer gestão completa de clientes, relatórios financeiros e múltiplos serviços.
              - generic [ref=e328]:
                - generic [ref=e329]: R$ 59
                - generic [ref=e330]: / mês
              - list [ref=e331]:
                - listitem [ref=e332]:
                  - generic [ref=e333]: ✓
                  - generic [ref=e334]: Tudo incluso no Plano Base
                - listitem [ref=e335]:
                  - generic [ref=e336]: ✓
                  - generic [ref=e337]: Múltiplos serviços com sinais diferentes
                - listitem [ref=e338]:
                  - generic [ref=e339]: ✓
                  - generic [ref=e340]: Relatórios de faturamento e sinais recebidos
                - listitem [ref=e341]:
                  - generic [ref=e342]: ✓
                  - generic [ref=e343]: Histórico completo e lista de clientes
                - listitem [ref=e344]:
                  - generic [ref=e345]: ✓
                  - generic [ref=e346]: Suporte prioritário via WhatsApp
            - link "Começar teste de 7 dias grátis" [ref=e348] [cursor=pointer]:
              - /url: /onboarding?plano=completo
        - generic [ref=e349]: 🔒 Teste sem risco por 7 dias. Sem fidelidade, sem pegadinhas e sem necessidade de cartão de crédito.
      - generic [ref=e351]:
        - generic [ref=e352]:
          - generic [ref=e353]: Tire Suas Dúvidas
          - heading "Perguntas frequentes" [level=2] [ref=e354]
        - generic [ref=e355]:
          - generic [ref=e356]:
            - heading "Preciso cadastrar cartão de crédito para fazer o teste?" [level=3] [ref=e357]
            - paragraph [ref=e358]: Não! O teste de 7 dias é totalmente livre. Você só decide assinar depois de testar na prática com seus clientes.
          - generic [ref=e359]:
            - heading "Como o cliente paga o sinal?" [level=3] [ref=e360]
            - paragraph [ref=e361]: Assim que ele escolhe o horário e digita o telefone, a tela gera um QR Code Pix instantâneo com código Copia e Cola e prazo de 15 minutos. Quando ele paga no aplicativo do banco dele, a reserva é confirmada imediatamente.
          - generic [ref=e362]:
            - heading "E se o cliente não pagar o Pix a tempo?" [level=3] [ref=e363]
            - paragraph [ref=e364]: Se passarem os 15 minutos sem pagamento, a pré-reserva expira e o horário volta a ficar livre para outro cliente agendar automaticamente. Você não perde a vaga.
          - generic [ref=e365]:
            - heading "Meu cliente precisa baixar algum aplicativo?" [level=3] [ref=e366]
            - paragraph [ref=e367]: Não. Ele apenas toca no seu link pelo celular e abre a página no navegador normal (Chrome, Safari, etc.). Funciona em qualquer celular.
          - generic [ref=e368]:
            - heading "Posso escolher quais serviços cobram sinal?" [level=3] [ref=e369]
            - paragraph [ref=e370]: "Sim. Você tem total controle: pode definir sinal de R$ 15, R$ 20, cobrar 50% do valor ou até mesmo deixar sem sinal para serviços específicos."
    - contentinfo [ref=e371]:
      - generic [ref=e372]:
        - generic [ref=e373]:
          - generic [ref=e374]:
            - generic [ref=e375]: A
            - generic [ref=e376]:
              - text: AgendaPix
              - paragraph [ref=e377]: Agendamento autônomo com sinal por Pix no Brasil
          - generic [ref=e378]:
            - link "Criar conta" [ref=e379] [cursor=pointer]:
              - /url: /onboarding
            - link "Como funciona" [ref=e380] [cursor=pointer]:
              - /url: "#como-funciona"
            - link "Vantagens" [ref=e381] [cursor=pointer]:
              - /url: "#recursos"
            - link "Planos & Preços" [ref=e382] [cursor=pointer]:
              - /url: "#precos"
            - link "Dúvidas" [ref=e383] [cursor=pointer]:
              - /url: "#perguntas-frequentes"
        - generic [ref=e384]:
          - paragraph [ref=e385]: © 2026 AgendaPix. Todos os direitos reservados.
          - paragraph [ref=e386]: Desenvolvido para barbearias, salões, clínicas, manicures e autônomos no Brasil.
  - complementary "Controles do Modo Preview" [ref=e387]:
    - button "MODO PREVIEW ▾" [ref=e388]:
      - generic [ref=e390]: MODO PREVIEW
      - generic [ref=e391]: ▾
```

# Test source

```ts
  1  | import { expect, test, type Locator } from "@playwright/test";
  2  | 
  3  | async function contrast(locator: Locator) {
  4  |   return locator.evaluate((element) => {
  5  |     const canvas = document.createElement("canvas");
  6  |     canvas.width = canvas.height = 1;
  7  |     const context = canvas.getContext("2d")!;
  8  |     const rgba = (color: string) => {
  9  |       context.clearRect(0, 0, 1, 1);
  10 |       context.fillStyle = color;
  11 |       context.fillRect(0, 0, 1, 1);
  12 |       return Array.from(context.getImageData(0, 0, 1, 1).data);
  13 |     };
  14 |     const layers: number[][] = [];
  15 |     for (let node: Element | null = element; node; node = node.parentElement) {
  16 |       layers.push(rgba(getComputedStyle(node).backgroundColor));
  17 |     }
  18 |     const blend = (base: number[], layer: number[]) => base.map((channel, index) => channel * (1 - layer[3] / 255) + layer[index] * layer[3] / 255);
  19 |     const background = layers.reverse().reduce(blend, [255, 255, 255]);
  20 |     const foreground = blend(background, rgba(getComputedStyle(element).color));
  21 |     const luminance = (channels: number[]) => channels.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  22 |     const a = luminance(foreground), b = luminance(background);
  23 |     return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  24 |   });
  25 | }
  26 | 
  27 | test("nova direção: contraste do sinal no booking claro", async ({ page }, info) => {
  28 |   await page.emulateMedia({ colorScheme: "light" });
  29 |   await page.goto("/preview/booking");
  30 |   const deposit = page.getByText("Sinal: R$ 25,00", { exact: true });
  31 |   await expect(deposit).toBeVisible();
  32 |   await page.screenshot({ path: info.outputPath("booking-light-375.png"), fullPage: true });
  33 |   expect(await contrast(deposit)).toBeGreaterThanOrEqual(4.5);
  34 | });
  35 | 
  36 | test("nova direção: contraste do hero escuro e CTA mobile", async ({ page }, info) => {
  37 |   await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  38 |   await page.goto("/preview/landing");
  39 |   const heading = page.getByRole("heading", { level: 1 });
  40 |   await expect(heading).toBeVisible();
  41 |   await page.screenshot({ path: info.outputPath("landing-dark-375.png"), fullPage: true });
  42 |   expect.soft(await contrast(heading)).toBeGreaterThanOrEqual(3);
  43 |   const cta = page.getByRole("link", { name: "Testar Booking", exact: true });
> 44 |   expect.soft((await cta.boundingBox())?.height).toBeGreaterThanOrEqual(44);
     |                                                  ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  45 |   await cta.focus();
  46 |   const focus = await cta.evaluate((element) => {
  47 |     const style = getComputedStyle(element);
  48 |     return (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
  49 |   });
  50 |   expect.soft(focus).toBe(true);
  51 | });
  52 | 
```