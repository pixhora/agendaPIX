# PLANOS DE FRONTEND POR AGENTE — refatoração de UI

Hermes (Operação/Performance) — 2026-10-04. Para: T4 (Antigravidade), T5 (Trilha), T6 (Prisma), T2 (CODEXADO).
Cada agente lê só a sua seção. Sem merge/push/deploy. Sistema local no ar (3000/3001/3005/3343).

## Estado real medido (não é achismo)

| Worktree | globals.css | Telas/componentes |
|---|---|---|
| agenda-booking-ui (T4) | 171 linhas | 16 páginas + 26 componentes (booking, landing, onboarding, preview, ui) |
| agenda-conversion (T5) | 95 linhas | 16 páginas + 25 componentes (landing, onboarding, auth) |
| agenda-dashboard (T2) | 43 linhas | 10 páginas + 10 componentes |
| agenda-ux-audit (T6) | — | só auditoria |

Problema raiz do visual: `globals.css` do booking usa `@media (prefers-color-scheme: dark)` (segue o SO),
fonte Arial de sistema, uma cor só (`#1D4ED8`), `docs/design-tokens.md` marcado "provisório", zero elemento-assinatura.
É exatamente a "cara de template" que o AGENTS.md §6 proíbe.

## Ferramentas de design — o que EXISTE de verdade (verificado)

**MCP (1 só, e é o único MCP real aqui):**
- **Context7** — IDs confirmados agora: Next.js `/vercel/next.js` (tem v16.x, casa com o Next 16.3.8 do projeto),
  Tailwind `/websites/tailwindcss`, shadcn/ui `/shadcn-ui/ui`. Serve para pegar API ATUAL (o AGENTS avisa que este
  Next não é o dos dados de treino). Já disponível para os agentes (skill `context7-mcp`).

**Ferramentas de prova visual (não são MCP, são CLI/skill — não chamar de MCP):**
- **Portal Maestri** (`maestri portal create URL --size 390x844` + `snapshot/click/screenshot`) — navegador REAL no
  canvas, em moldura de celular. É o melhor jeito do humano VER a tela.
- **agent-browser** (skill) — Playwright CLI headless, screenshot 375/1280, console.
- **computer_use / cua-driver** — desktop, quando headless não basta.

**Skills de design disponíveis nos agentes agy** (`~/.gemini/config/skills` + `~/.gemini/skills`):
`design-system`, `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`, `vercel-react-best-practices`,
`context7-mcp`, `agent-browser`, `maestri-portal` + as novas do Matt: `prototype`, `grill-with-docs`,
`codebase-design`, `domain-modeling`, `implement`, `tdd`, `code-review`, `triage`, `diagnosing-bugs`,
`writing-for-agents`, `to-spec`, `to-tickets`, `grilling`, `setup-matt-pocock-skills`.

---

## T4 — Antigravidade (agenda-booking-ui) · dono do design system

### T4-A — Fundação: tokens, tipografia e dark de verdade
Objetivo: sair do provisório. Uma decisão visual, seguida sempre.
Passos: (1) `prototype` num HTML descartável para decidir a identidade; (2) `grill-with-docs` para fechar 4–6 cores
com hex, 2 famílias, escala 14/16/20/28/40/64, raios 6/12/16; (3) escrever `docs/design-tokens.md` final;
(4) reescrever `app/globals.css` com tokens em `:root` **e `.dark` explícito**; (5) `next/font` em `app/layout.tsx`.
MCP/skill: Context7 `/websites/tailwindcss` (`@theme` + `@variant dark`) e `/vercel/next.js` v16 (`next/font`);
skills `design-system`, `frontend-design`, `prototype`, `grill-with-docs`.
Pronto quando: `.dark` próprio (não `prefers-color-scheme`), 2 fontes carregadas sem download no build, contraste AA.

### T4-B — Elemento-assinatura: a régua de horários
Objetivo: a "coisa memorável" — é a tela que o cliente final mais toca.
Passos: (1) `prototype`; (2) refatorar `components/booking/StepSlot.tsx` (+ `StepService`, `StepProgress`);
(3) corrigir o débito `StepSlot.tsx:188` (`no-scrollbar` sem definição no `globals.css` → barra nativa clara no escuro);
(4) `ui-ux-pro-max` + `web-design-guidelines` para hierarquia e toque ≥44px.
Prova: portal Maestri 390x844 do `http://localhost:3001/barbearia-demo` + screenshot 375/1280 claro/escuro.

### T4-C — Consistência do Preview e peso no mobile
Objetivo: matar a "cara de template" nas 7 telas de Preview.
Passos: (1) `web-ui-layout-audit` nas `app/preview/*`; (2) corrigir abas que cortam em 375px
(`app/preview/reservas/page.tsx:73`, achado do T6); (3) `PreviewNav.tsx` unificar; (4) medir JS servido por rota.
Skill: `agent-browser`, `web-ui-layout-audit`, `vercel-react-best-practices`.

---

## T5 — Trilha (agenda-conversion) · conversão

### T5-A — Landing que converte
Passos: (1) `grilling` sobre a oferta; (2) `to-spec` → `to-tickets`; (3) refatorar `components/landing/*`
(11 componentes: Hero, HeroVisual, Pricing, Faq, TrustBand, InteractiveDemo…); (4) preço R$49/R$79 de
`docs/PRECOS.md`; (5) UMA sequência de entrada no hero, nada de fade-up em toda seção.
Skills: `grilling`, `to-spec`, `to-tickets`, `frontend-design`, `ui-ux-pro-max`.

### T5-B — Onboarding sem fricção
Passos: refatorar `components/onboarding/*` (5 passos), `app/onboarding/page.tsx`, `app/login/page.tsx`,
`components/auth/LoginForm.tsx`. Critério do AGENTS: ação principal em ≤3 toques.
Skills: `to-tickets`, `implement`, `writing-for-agents`.

### T5-C — Consumo dos tokens do T4 (bloqueado por T4-A)
Passos: `app/globals.css` (95 linhas) passa a importar os tokens de T4 — **sem design system paralelo**;
aplicar `ui-localization` para pt-BR sem jargão ("horários", "clientes", "sinal").
Bloqueio: T4-A publicar os tokens. Resend sem domínio próprio: só com o humano.

---

## T6 — Prisma (agenda-ux-audit) · auditoria

### T6-A — Auditoria por tela com evidência
Passos: abrir cada rota (3000, 3001, 3005, 3343) no portal 390x844 e em 1280; classificar
`BLOQUEIA/MELHORAR/OK` com arquivo:linha + viewport + screenshot. Skills: `triage`, `code-review`,
`web-design-guidelines`. Já iniciado: 2 achados reais entregues.

### T6-B — Acessibilidade e toque
Passos: contraste, foco de teclado visível, labels, alvos ≥44px, `prefers-reduced-motion`.
Skills: `web-design-guidelines`, `to-questionnaire` (quando o pedido chega ambíguo).

### T6-C — Revalidação pós-correção
Passos: reauditar cada entrega de T4/T5/T2 no commit identificado; só então mudar para `OK`.
NUNCA reescrever o código dos autores. Skills: `code-review`, `diagnosing-bugs`.

---

## T2 — CODEXADO (agenda-dashboard) · painel do dono

### T2-A — Login alinhado ao design system (OK reclassificado por T6 em 7175251)
Achado: `components/dashboard/login-form.tsx:8` agora alinhado aos tokens oficiais T4-A via `login-form.module.css`.
Passos: tokens aplicados (Plus Jakarta Sans, Inter, lime #c0f739, card #ffffff/#141f1a, alvos 48px, zero overflow 375/390/1280px).
Pronto quando: Reclassificado de BLOQUEIA para OK por T6 (relatório docs/RECLASSIFICACAO_T2A_LOGIN_2026-10-04.md).


### T2-B — Shell e navegação do painel
`components/dashboard/shell.tsx`, `navigation.tsx`, `app/dashboard/(owner)/*` (agenda, clientes, serviços, config).
Skill: `codebase-design`, `web-ui-layout-audit`.

### T2-C — Estados e movimento
`loading.tsx`/`error.tsx` já existem — completar vazio e sucesso; `motion.module.css` respeitar
`prefers-reduced-motion`. Skill: `web-design-guidelines`.

---

## Ordem e dependências
1. **T4-A** (tokens) — destrava todo o resto.
2. **T4-B / T4-C** e **T2-A** em paralelo (independentes dos tokens? não: T2-A depende).
3. **T5-A / T5-B** em paralelo (spec não depende de tokens); **T5-C** espera T4-A.
4. **T6** audita em paralelo desde já e revalida no fim.

## Definição de pronto (vale para todo plano)
- [ ] 375px primeiro, sem overflow; desktop depois.
- [ ] Estados carregando/vazio/erro/sucesso em toda tela que busca dado.
- [ ] `prefers-reduced-motion` respeitado; alvos ≥44px; foco visível; labels.
- [ ] Prova por screenshot 375/1280, claro/escuro, console limpo.
- [ ] `lint`/`typecheck`/`test` verdes + revisor designado.
- [ ] Nada de: card igual para tudo, CAIXA ALTA espaçada em todo título, setinha em todo botão,
      fade-up em toda seção, hover em todo card.
