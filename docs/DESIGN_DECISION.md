# Decisão de Design System — agendaPIX

| Campo | Valor |
|---|---|
| Produto | agendaPIX (SaaS BR de agendamento + Pix) |
| Data | 2026-10-05 (America/Sao_Paulo, UTC-3) |
| Status | **Decisão documentada — v1.1** (v1 da pesquisa de bibliotecas + ajustes da pesquisa visual, §15) |
| Código analisado | branch `feat/frontend-consolidation` (PR #2), somente leitura na v1; aplicada em `feat/frontend-redesign` |
| Stack confirmada | Next.js **16.3.8**, React **^19.2**, TypeScript, Tailwind CSS **4.3.3** (`@tailwindcss/postcss` 4.3.3), Better Auth, Drizzle/Postgres, pnpm |

---

## 1. Resumo executivo

**Decisão:** manter e expandir **shadcn/ui (estilo `new-york`) sobre Radix UI**, com os **tokens v2 já homologados** (Editorial Mineral + `ValueSlab`), adicionando **react-day-picker v9** (via componente Calendar do shadcn) para calendários do painel/onboarding, e **Sonner** para toasts — sem trocar a biblioteca-base agora.

**Não migrar agora para Base UI**, Mantine, Chakra, HeroUI ou similar: o custo de troca não se justifica enquanto a superfície de `components/ui` ainda é pequena (Button + ValueSlab) e a identidade visual própria já está definida. shadcn recomenda explicitamente não migrar apps em produção só porque Base UI virou o default de projetos novos ([changelog jul/2026](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)).

**Por quê:** menor custo de migração a partir do código atual; compatibilidade comprovada com React 19 + Tailwind v4 + RSC; identidade própria preservada via tokens e componentes de domínio (`ValueSlab`, régua de datas do booking); acessibilidade via primitivas Radix + padrões WCAG 2.2 AA já parcialmente auditados.

---

## 2. Estado atual do código (auditado)

### 2.1 Dependências relevantes (`package.json`)

- `next@16.3.8`, `react@^19.2.0`, `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`
- UI parcial shadcn: `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`
- `components.json`: estilo **`new-york`**, `rsc: true`, CSS variables, `baseColor: slate`
- **Não** há ainda Calendar, Dialog, Select, Table, Toast etc. — só `button.tsx` e `value-slab.tsx`

### 2.2 Design system v2 (homologado)

Fonte: `docs/design-tokens.md` + `app/globals.css`.

| Token | Claro | Escuro | Função |
|---|---|---|---|
| `--paper` | `#F6F5F2` | `#0F0F10` | Fundo canvas mineral |
| `--surface` | `#FFFFFF` | `#19191B` | Cartões / molduras |
| `--ink` | `#0B0B0C` | `#F6F5F2` | Texto e botão primário |
| `--muted` | `#5B5B5F` | `#A3A3A8` | Apoio (~6:1 vs paper) |
| `--line` | `#DEDCD6` | `#2C2C2F` | Bordas |
| `--lime` | `#C0F739` | `#C0F739` | Dot/chip de estado apenas |
| `--slab` | `#0B0B0C` | `#000000` | Placa de Valor |
| `--danger` | `#B3261E` | `#FF8A80` | Erro |
| `--ring` | `#0B0B0C` | `#C0F739` | Foco |

**Assinatura:** `ValueSlab` — placa escura com valor em `Plus Jakarta Sans` 40–64px (`tabular-nums`), usada no Pix, pricing e métricas do painel.

**Tipografia:** display = Plus Jakarta Sans; corpo = Inter.

**Raios:** frame 32px, card 14px, field 12px, botões `rounded-full`.

**Toque:** `min-h-11` (44px) — acima do mínimo WCAG 2.2 AA de 24×24 CSS px; alinhado a Apple HIG (~44pt).

**Movimento:** `--duration-feedback/opening/step` + `@media (prefers-reduced-motion: reduce)` global em `globals.css`.

### 2.3 Superfícies e componentes existentes

| Superfície | Rotas / pastas | Estado |
|---|---|---|
| Booking público | `app/[slug]`, `components/booking/*` | Fluxo 4 passos + Pix (QR, copia-e-cola, timer 15 min, polling 4s) |
| Landing | `app/page.tsx`, `components/landing/*` | Editorial + pricing com ValueSlab |
| Onboarding | `app/onboarding`, `components/onboarding/*` | Conta (magic link), negócio, serviço, horários |
| Login | `app/login`, `components/auth` | Magic link único |
| Painel | `app/dashboard/(owner)/*`, `components/dashboard/*` | Shell, serviços, reservas, settings, Pix key |

Auditorias UX/a11y (`docs/AUDITORIA_UX_2026-10-03.md`, `AUDITORIA_T6BC_ACESSIBILIDADE_2026-10-04.md`): contraste AA/AAA medido, alvos ≥44px, reduced-motion, labels em login/onboarding; pendências históricas de overflow/nav/aria em parte já corrigidas.

### 2.4 Observação no repositório

~~`docs/design-tokens.md` contém marcadores de conflito de merge~~ — resolvido na consolidação (PR #2) e reescrito no redesign com os tokens v2.1.

`AGENTS.md` já prevê: **Tailwind + shadcn/ui (Radix)**.

---

## 3. Pesquisa de bibliotecas de UI (fontes reais)

### 3.1 shadcn/ui + Radix + Base UI

- **Tailwind v4 + React 19:** documentação oficial — CLI inicializa com v4, suporte a `@theme` / `@theme inline`, `data-slot`, toast legado depreciado em favor de **Sonner**, estilo `default` depreciado em favor de **`new-york`**, cores OKLCH em projetos novos. ([ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4))
- **Base UI como default (jul/2026):** novos projetos usam Base UI por padrão; **Radix continua suportado e não depreciado**; recomendação explícita: *“If your app works, keep shipping”*; flag `shadcn init -b radix`. ([changelog](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default))
- **Base UI v1:** ~35 componentes headless acessíveis (MUI + ex-contribuidores Radix/Floating UI); RTL e CSP providers. ([InfoQ](https://www.infoq.com/news/2026/02/baseui-v1-accessible/), [base-ui.com](https://base-ui.com/react/utils/csp-provider))
- **Comparativos 2026:** Base UI mais ativo em manutenção; Radix ainda dominante via shadcn; Context Menu / Hover Card / Toast ainda mais fortes no ecossistema Radix. ([ShadcnDeck](https://www.shadcndeck.com/blog/radix-vs-base-ui), [GreatFrontEnd](https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026))

### 3.2 Alternativas avaliadas

| Biblioteca | Natureza | Notas factuais da pesquisa |
|---|---|---|
| **Radix Themes** | Temático (não headless) | Identidade visual própria; conflita com tokens minerais + ValueSlab |
| **React Aria / Spectrum** | Headless + i18n | Calendários com anúncios de SR excelentes; maior custo de composição. ([react-aria.adobe.com](https://react-aria.adobe.com/Calendar/useCalendar)) |
| **Ark UI / Park UI** | Headless multi-framework / copy-paste | Park usa Ark + Panda; stack diferente do Tailwind v4 atual |
| **Mantine** | Full kit (CSS Modules) | 100+ componentes; menos alinhado a “código próprio + tokens” |
| **HeroUI (ex-NextUI)** | Tailwind + React Aria | Bom polish; duplicaria sistema visual |
| **Chakra v3** | Ark + Panda | Mudança grande de styling |
| **Tremor** | Dashboard charts/cards | Útil *depois* se o painel precisar de gráficos; não como base |
| **Catalyst / Tailwind Plus** | Templates pagos Tailwind | Referência visual; não substitui design system próprio |
| **Geist / Linear / Stripe** | Produtos de referência | Referência de densidade e clareza (ver §11) |

### 3.3 Design systems maduros (referência, não adoção direta)

| Sistema | Por que olhar | Link |
|---|---|---|
| Material 3 | Tokens, date pickers mobile full-screen | [m3.material.io](https://m3.material.io/) / [date pickers](https://m3.material.io/components/date-pickers/guidelines) |
| Apple HIG | Alvos ~44pt, foco, pickers nativos | [developer.apple.com/design](https://developer.apple.com/design/human-interface-guidelines/accessibility) |
| IBM Carbon | Densidade de dados / tabelas | [carbondesignsystem.com](https://preview.carbondesignsystem.com/building-blocks/core/components/date-picker/guidelines) |
| Shopify Polaris | Admin de comerciante (próximo do dono agendaPIX) | Pesquisa secundária em catálogos 2025–26 |
| Atlassian | Workflows complexos | Idem |
| GOV.UK | Clareza + a11y pública | [design-system.service.gov.uk](https://design-system.service.gov.uk/) (via listagens) |
| GitHub Primer | Ferramentas dense / developer | Catálogos DS |
| **Gov.br DS** | Padrão digital BR, fundamentos, a11y | [gov.br/ds](https://www.gov.br/ds) |
| **Nubank NuDS** | Tokens/temas, acessibilidade em escala BR | [Figma customer story](https://www.figma.com/pt-br/customers/nubank-design-system-accessible-experiences-with-figma/) |
| Mercado Pago | Padrões de Pix (não DS visual público completo) | [docs Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix) |

---

## 4. Padrões de booking e checkout Pix (pesquisa)

### 4.1 Booking mobile-first

- **Cal.com (open source):** fluxo Booker (meta → calendário mês → slots → formulário → confirmação). Starter kit usa Next 16, React 19, Tailwind v4, react-day-picker v9. Em mobile, opção `useSlotsViewOnSmallScreen`: escolhe data → slots em modal (evita scroll confuso). ([docs Booker Embed](https://cal.com/docs/atoms/booker-embed), [PR #26583](https://github.com/calcom/cal.com/pull/26583), [developer-starter-kit](https://github.com/calcom/developer-starter-kit))
- **Material 3:** em viewport compacto, date picker em modal/full-screen; em layouts largos, docked. ([guidelines](https://m3.material.io/components/date-pickers/guidelines))
- **Fresha / Booksy / Square Appointments:** padrões de mercado — seleção de data, lista de horários reais (não relógio genérico), profissional, confirmação. (observação de produtos públicos / screenshots em Mobbin/Uiland; detalhes visuais em §11)
- **agendaPIX atual:** régua horizontal de 7 dias + grade de slots (`StepSlot.tsx`) — padrão próximo a Booksy/Fresha e válido para celular; manter e enriquecer (indicadores de disponibilidade, “mais dias”, empty states).

### 4.2 Checkout Pix

Documentação Mercado Pago (Checkout Transparente / Orders):

- Resposta traz `qr_code` (copia-e-cola), `qr_code_base64` (imagem) e/ou `ticket_url`
- Status inicial `action_required` + `status_detail=waiting_transfer`
- `expiration_time` ISO-8601: entre **30 minutos e 30 dias** (padrão frequentemente 24h no gateway; agendaPIX usa **15 min** de pré-reserva de slot — regra de produto, não do MP)
- Após vencimento sem pagamento → cancelado/expirado; cancelar pendentes evita conciliação ruim  
  Fonte: [Mercado Pago — Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix)

**Implementação atual (`StepPayment.tsx`):** ValueSlab do sinal + QR + input readonly copia-e-cola + botão Copiar + timer + polling 4s + botão “Já fiz o pagamento” + estado expirado. Alinhar anúncios `aria-live` ao status (espera / confirmado / expirado) — hoje erro de check já usa `role="alert"`.

---

## 5. Acessibilidade (alvo WCAG 2.2 AA)

Fonte: [What's New in WCAG 2.2 (W3C)](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

| Critério | Requisito | Aplicação agendaPIX |
|---|---|---|
| **2.5.8 Target Size (Minimum)** | ≥ **24×24** CSS px (ou espaçamento equivalente) | Manter **44×44** (`min-h-11`) como padrão de produto |
| **2.4.7 Focus Visible** | Indicador de foco visível | `--ring`: ink no claro, lime no escuro; `focus-visible:outline-2` |
| **2.4.11 Focus Not Obscured** | Foco não totalmente escondido | Cuidado com sticky CTAs / bottom bars no booking |
| **3.3.8 Accessible Authentication** | Sem teste cognitivo obrigatório | Magic link já é o padrão correto |
| Status assíncrono | `aria-live` / `role="status"` | Espera do Pix, confirmação, expiração, salvamento no painel |
| Reduced motion | Respeitar preferência | Já em `globals.css` |
| Contraste | Texto ≥ 4.5:1 | Tokens v2; **lime nunca como texto** sobre paper (doc v2: ~1,2:1) |

Calendários: shadcn Calendar (react-day-picker v9) ou, se auditoria exigir anúncios mais ricos, React Aria `Calendar` como upgrade pontual.

---

## 6. Tabela comparativa de candidatos

Legenda de notas: ●●● alto / ●● médio / ● baixo (julgamento relativo à stack e ao código atual).

| Candidato | A11y | React 19 / Next 16 / RSC | Tailwind v4 | Bundle | Identidade própria | Maturidade | Data/hora | Custo migração |
|---|---|---|---|---|---|---|---|---|
| **shadcn + Radix (atual)** | ●●● | ●●● (docs oficiais) | ●●● | ●●● (código no repo) | ●●● (tokens v2) | ●●● | ●● via day-picker | **● mínimo** |
| shadcn + Base UI (novo default) | ●●● | ●●● | ●●● | ●●● | ●●● | ●●● (v1.6+) | ●● | ●● (migração progressiva; skill oficial) |
| React Aria Components | ●●●● | ●●● | ●● (você estiliza) | ●● | ●●● | ●●● | ●●●● | ●●● (reescrever UI) |
| Radix Themes | ●●● | ●●● | ● | ●● | ● (tema Radix) | ●●● | ●● | ●●● |
| Mantine | ●●● | ●● | ● | ● | ● | ●●● | ●●● | ●●●● |
| HeroUI | ●●● | ●● | ●●● | ●● | ● | ●● | ●● | ●●●● |
| Chakra v3 / Park (Ark+Panda) | ●●● | ●● | ● (Panda) | ●● | ●● | ●● | ●● | ●●●● |
| Tremor | ●● | ●● | ●● | ●● | ● | ●● | ● | Só dashboards |
| Catalyst / Tailwind Plus | ●● | ●●● | ●●● | ●●● | ●● (templates) | ●● (pago) | ●● | Referência / blocos |

---

## 7. Decisão e justificativa

### Escolha única (combinação)

> **shadcn/ui (`new-york`) + Radix UI + tokens v2 (ValueSlab) + react-day-picker v9 (Calendar shadcn) + Sonner**

Opcional futuro (não bloqueia MVP):

- Migrar **componentes novos** para variantes Base UI do shadcn quando fizer sentido (Combobox etc.), sem big-bang
- React Aria Calendar se day-picker falhar auditoria de leitores de tela no painel
- Tremor ou Recharts **somente** se o painel ganhar gráficos de faturamento

### Por quê esta combinação

1. **Já está no projeto** (`components.json`, Slot, Button, Tailwind 4, RSC).
2. **AGENTS.md** e tokens v2 já orientam shadcn + identidade mineral.
3. shadcn **desaconselha** migrar só porque Base UI é default de projetos novos.
4. Identidade memorável (`ValueSlab`, lima como acento fino, pílula preta) exige controle total do CSS — headless copy-paste vence kits temáticos.
5. Cliente final é **mobile**; booking já tem régua tátil auditada — não precisa trocar por um date picker genérico no funil público.
6. Painel/onboarding precisam de Calendar/DateField acessíveis → day-picker v9 é o caminho oficial do shadcn e do starter Cal.com.

### O que explicitamente **não** fazer agora

- Trocar Tailwind por Panda/CSS-in-JS
- Adotar Mantine/Chakra/HeroUI como skin global
- Usar `--lime` em texto/botão primário no modo claro
- Substituir a régua do booking por calendário mensal cheio no primeiro paint mobile (anti-padrão vs Fresha/Cal mobile modal)

---

## 8. Tokens recomendados (normativos)

Manter a paleta v2. Contrastes declarados no doc interno (verificação documentada nas auditorias T6; valores hex abaixo são os do código):

| Par | Uso | Nota de contraste |
|---|---|---|
| ink `#0B0B0C` × paper `#F6F5F2` | Texto / botão | ~18:1 (AAA) — `design-tokens.md` |
| muted `#5B5B5F` × paper | Secundário | ~6:1 (AA) — `design-tokens.md` |
| lime `#C0F739` × slab | Dot/chip | 15:1 vs slab — **proibido** como texto sobre paper |
| danger `#B3261E` × paper | Erro claro | Validar ≥4.5:1 em QA visual |
| danger escuro `#FF8A80` × paper escuro | Erro dark | Idem |

**Espaçamento:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64; padding lateral mobile 16px.

**Sombras:** preferir bordas `--line` + sombra mínima (`shadow-xs`/`shadow-sm`); atmosfera “mineral editorial”, não neumorphism.

**Modo escuro:** classe `.dark` + `prefers-color-scheme` já em `globals.css`; ring de foco vira lime no escuro.

**Tipografia:** manter Plus Jakarta Sans + Inter; escala 14 / 16 / 20 / 28 / 40 / 64.

---

## 9. Componentes necessários por superfície

### 9.1 Primitivas shadcn a adicionar (ordem sugerida)

| Componente | Booking | Landing | Onboarding | Login | Painel |
|---|---|---|---|---|---|
| Button (já existe) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Input / Label / Textarea | ✓ | | ✓ | ✓ | ✓ |
| Card | ✓ | ✓ | ✓ | ✓ | ✓ |
| Badge / StatusChip (já em value-slab) | ✓ | ✓ | | | ✓ |
| Separator | ✓ | ✓ | ✓ | | ✓ |
| Dialog / AlertDialog | | | | | ✓ |
| Sheet (mobile nav / filtros) | | | | | ✓ |
| Tabs | | | | | ✓ |
| Select / DropdownMenu | | | ✓ | | ✓ |
| Switch / Checkbox | | | ✓ | | ✓ |
| Table | | | | | ✓ |
| Skeleton | ✓ | ✓ | ✓ | | ✓ |
| Sonner (toast) | | | ✓ | ✓ | ✓ |
| Calendar + Popover (day-picker) | opcional | | ✓ horários | | ✓ |
| Empty state (custom) | ✓ | | | | ✓ |
| Progress / Stepper (custom StepProgress) | ✓ | | ✓ | | |

### 9.2 Componentes de domínio (manter/criar)

- `ValueSlab`, `StatusChip`
- `StepProgress` (booking/onboarding)
- Régua de datas + grade de slots
- `PixCheckout` (QR + copia-e-cola + timer + live region)
- `AgendaDayView` / `AgendaWeekView` (painel)
- `BookingStatusBadge` (já há `booking-status.tsx`)

---

## 10. Padrões de UX por jornada

### 10.1 Agendamento + Pix (cliente, mobile-first)

1. **Serviço** — cards grandes (≥44px), preço e duração visíveis, um selecionado por vez (radio group).
2. **Data/hora** — régua de dias (Hoje/Amanhã + weekday) com fade de scroll; slots só reais; empty: “Sem horários neste dia” + próximo dia disponível; loading skeleton na grade.
3. **Dados** — nome + telefone/e-mail; labels explícitos; sem pedir de novo o que já veio (WCAG 3.3.7).
4. **Resumo** — repetir serviço, data/hora, valor do sinal **antes** de gerar Pix (ValueSlab).
5. **Pix** — ValueSlab + timer; QR grande em fundo branco; copia-e-cola + “Copiado!” anunciado; `role="status"` “Aguardando confirmação do Pix…”; polling + ação manual; estados: waiting → confirmed (confirmPop) → expired (liberar slot, CTA “Novo agendamento”).
6. **Confirmação** — comprovante claro, o que fazer se atrasar, contato do negócio.

### 10.2 Landing

Hero curto, prova social/confiança, demo interativa leve, pricing com ValueSlab (R$ planos), CTA “Começar” → onboarding, “Entrar” → `/login`.

### 10.3 Onboarding do dono

Passos: conta (magic link) → negócio/slug → primeiro serviço → horários → pronto (link público). Persistência de draft (já existe). Inputs ≥16px / altura ~48px (evitar zoom iOS).

### 10.4 Login

Único `/login`, magic link (WCAG 3.3.8). Erros com `role="alert"` + `aria-invalid`.

### 10.5 Painel SaaS

- **Agenda:** vista dia (default mobile) / semana (desktop); blocos por status (pendente Pix / confirmado / cancelado).
- **Tabelas:** reservas e pagamentos — ordenação simples, filtros em Sheet no mobile.
- **Estados vazios:** ilustração mínima + CTA (“Cadastrar serviço”, “Compartilhar link”).
- **Feedback:** toast Sonner + texto inline “Salvando…”.
- Navegação mobile: grid/tabs sempre visíveis (aprendizado das auditorias T6).

---

## 11. Referências visuais

Capturas comprimidas e a lista completa (link, o que mostra, por que importa) em [`docs/design-refs/`](design-refs/README.md). Foram 39 capturas em duas levas: (1) shadcn, Radix, Geist, Linear, Stripe, Dribbble e Pinterest; (2) Behance, Land-book, Godly/recent.design, Awwwards e Refero. Mobbin e Refero completos pedem login e ficaram de fora.

### 11.1 Conclusões que viraram regra

| # | Conclusão | Referências | Onde foi aplicada |
| --- | --- | --- | --- |
| 1 | **Base neutra e um único acento.** O verde-água do Pix é o acento de pagamento/"pago"; o resto é tinta, papel e linhas finas. | 01, 07, 16, 34 | Tokens `--pix`/`--pix-soft`; lima aposentada (§15) |
| 2 | **Seletor de horário:** faixa horizontal de dias em pills e horários agrupados em manhã/tarde/noite com botões ≥44 px, num stepper serviço → data/hora → dados → Pix. | 14, 22, 26 | `components/booking/StepSlot.tsx` |
| 3 | **Resumo estilo Stripe antes do QR:** valor em destaque no topo, linhas de item e total. | 11, 12 | `StepCustomer` (resumo) e `StepPayment` |
| 4 | **Tela do Pix:** QR grande em fundo branco, botão "Copiar código Pix", contador de expiração, status anunciado por `aria-live` e confirmação com check. | 15, 16, 23 | `StepPayment`, `BookingConfirmation` |
| 5 | **Pedir só nome e WhatsApp antes do Pix**, sem cadastro com senha. | 26, 39 (✗) | `StepCustomer` |
| 6 | **Landing:** título com o benefício, um CTA primário com microcopy anti-objeção ("Grátis, sem cartão"), print real do produto e prova social acima da dobra; bloco "3 passos". | 29, 30, 31, 35, 37 | `components/landing/*` |
| 7 | **Painel:** cards de KPI (agendamentos hoje, receita via Pix, pendentes), agenda em colunas por dia, lista com badges de status com ícone além da cor, detalhe em painel lateral; no mobile, cards. | 02, 04, 19, 24, 38 | `app/dashboard/(owner)/*`, `components/dashboard/*` |
| 8 | **Configurações do link ao lado da agenda/calendário.** | 36 | `/dashboard/settings` (link público + Pix + horários) |
| 9 | **Acessibilidade:** labels visíveis, foco visível, contraste WCAG 2.2 AA, fonte ≥14 px no mobile, status com ícone além da cor, `prefers-reduced-motion`. Evitar cinza claro sobre pastel ou preto (08, 13, 18, 39). | 06, 39 (✗) | Global |

### 11.2 Anti-padrões observados

- Cinza claro sobre preto (Linear, 08) e pastéis com texto claro (18): contraste abaixo de AA.
- Cadastro longo com senha antes de agendar (39).
- Mockups 3D e azul vibrante genérico (25): não ajudam o fluxo.
- Calendário mensal cheio no primeiro paint do mobile (Material/Cal.com usam modal; mantemos a faixa de dias).

## 12. Plano de migração em etapas

Premissa: **não reescrever** booking/landing que já passam auditoria; expandir `components/ui` e alinhar o painel.

### Etapa 0 — Higiene (0,5–1 dia)

- Resolver conflito de merge em `docs/design-tokens.md`
- Congelar tokens v2 como fonte da verdade (já em `globals.css`)
- Documentar aliases (`--background` ← `--paper`, etc.)

### Etapa 1 — Fundação shadcn (1–2 dias)

- `pnpm dlx shadcn@latest add` dos primitivos da §9.1 (manter `--base radix` / estilo atual)
- Adicionar **Sonner** (toast oficial pós-depreciação do toast shadcn)
- Garantir `data-slot` e padrões React 19 (Button já está sem forwardRef)

### Etapa 2 — Formulários e auth (1–2 dias)

- Unificar Input/Label entre login, onboarding e dashboard forms
- Revisar `aria-*` e mensagens de erro (padrão `/login`)

### Etapa 3 — Booking Pix a11y (1 dia)

- Live region de status do pagamento (waiting/confirmed/expired)
- Anunciar “Código copiado”
- Revisar Focus Not Obscured com CTA sticky

### Etapa 4 — Painel (2–4 dias)

- Table + Badge de status + empty states
- Calendar (day-picker) para filtros de data / configuração de exceções
- Sheet/Tabs para navegação mobile
- Vista dia da agenda (prioridade) antes de semana completa

### Etapa 5 — Polish e opcionais (contínuo)

- Alinhar motion aos tokens de duração
- Avaliar Tremor/Recharts só se houver métricas gráficas
- Reavaliar Base UI **somente** se faltar primitiva (ex.: Combobox avançado) ou em greenfield de pacote UI

### Critérios de aceite por etapa

- Contraste AA nos pares de texto
- Alvos ≥44px nos CTAs principais
- `prefers-reduced-motion` sem regressão
- Nenhuma dependência nova que imponha tema visual externo sobre `--paper/--slab`

---

## 13. Fontes citadas (URLs)

1. https://ui.shadcn.com/docs/tailwind-v4  
2. https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default  
3. https://ui.shadcn.com/docs/changelog/2026-03-cli-v4  
4. https://www.infoq.com/news/2026/02/baseui-v1-accessible/  
5. https://base-ui.com/react/utils/csp-provider  
6. https://www.shadcndeck.com/blog/radix-vs-base-ui  
7. https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026  
8. https://react-aria.adobe.com/Calendar/useCalendar  
9. https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/  
10. https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix  
11. https://cal.com/docs/atoms/booker-embed  
12. https://github.com/calcom/cal.com/pull/26583  
13. https://github.com/calcom/developer-starter-kit  
14. https://m3.material.io/components/date-pickers/guidelines  
15. https://www.gov.br/ds  
16. https://www.figma.com/pt-br/customers/nubank-design-system-accessible-experiences-with-figma/  
17. https://developer.apple.com/design/human-interface-guidelines/accessibility  
18. Código local: `package.json`, `components.json`, `app/globals.css`, `docs/design-tokens.md`, `components/ui/*`, `components/booking/*`, auditorias em `docs/AUDITORIA_*`

---

## 14. Conclusão

O agendaPIX **já tem** a decisão visual certa (v2 mineral + ValueSlab) e a base técnica certa (shadcn/Radix + Tailwind 4 + React 19). A decisão de engenharia é **aprofundar esse caminho**: completar a biblioteca de primitivos shadcn, endurecer a11y do Pix e profissionalizar o painel — sem reescrever o design system em cima de um kit temático externo.

---

## 15. Ajustes após a pesquisa visual (v1.1, 2026-10-05)

A combinação de bibliotecas do §7 **continua valendo**: shadcn/ui `new-york` + Radix + tokens v2 + ValueSlab + react-day-picker v9 + Sonner. A pesquisa visual mudou só tokens e padrões, não a biblioteca. Mudanças decididas no redesign (`feat/frontend-redesign`), com justificativa:

| Ajuste | Antes (v1) | Agora (v1.1) | Por quê |
| --- | --- | --- | --- |
| Acento | Lima `#C0F739` como "acento fino" | **Verde-água Pix** `--pix` (`#0B7A6E` claro / `#3FD0BE` escuro) como único acento, de pagamento e "pago" | A pesquisa (16, 34, conclusão 1 e parte 2 §5) pede um único acento ligado ao Pix. A lima não passa AA como texto no claro (1,2:1); o verde-água escuro passa (5,2:1 em branco; 4,8:1 no papel). |
| Fundos sutis | `bg-muted` (cor de **texto** `#5B5B5F`) usado como fundo em prefixo de slug e skeletons | Token novo `--subtle` (`#EFEEEA` / `#222225`) para fundos; `muted` só para texto | Pendência 7 do PR #2: contraste ruim de texto sobre `bg-muted`. |
| Estados | Só cor + ponto | Badge com **ícone + texto + cor** (`--success`, `--warning`, `--danger`, neutro) | WCAG 1.4.1 (uso de cor) e conclusão 9. |
| Modo escuro | Só `prefers-color-scheme` | Toggle claro/escuro/sistema; classe `.dark`/`.light` aplicada por script inline antes da pintura (sem flash) e salva em `localStorage` | Pendência 5 do PR #2 (MELHORAR da auditoria T6-A). |
| Calendário | day-picker para painel/onboarding | day-picker v9 **no seletor de data do painel** (popover). Na página pública fica a faixa de dias (§7, "não fazer") | Conclusão 2; o funil mobile não ganha calendário mensal. |
| Toasts | Sonner | Sonner no painel (salvar serviço, horários, chave Pix) e no "Código copiado" do Pix, sempre com o texto inline / `aria-live` mantido | Feedback visível sem depender só do toast. |
| Ícones | — | `lucide-react` (padrão do shadcn new-york) | Ícones de status e navegação; árvore tree-shaken. |
| Checagem automática | — | `@axe-core/playwright` no e2e (WCAG 2.2 A/AA) | Critério de aceite do §12. |

Fora do escopo desta rodada (registrado como pendência no PR): colunas por **profissional** na agenda (o modelo de dados ainda não tem profissionais; as colunas são por dia), gráficos de faturamento (Tremor/Recharts) e migração para Base UI.
