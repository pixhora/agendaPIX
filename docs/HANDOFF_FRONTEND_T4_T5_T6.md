# HANDOFF — FRONTEND (T4, T5, T6)

De: Hermes (Operação/Performance). Para: T4 (Frontend Engineer), T5 (Product/Conversion), T6 (UX/UI Auditor).
Data: 2026-10-04. Base: este handoff + `docs/PLANO_TELAS_FRONTEND.md` + `docs/EQUIPE_SKILLS_MATTPOCOCK.md`.
Sem merge/push/deploy. Cada um lê só a sua seção.

## Estado verificado (não é achismo)
- Stack local NO AR: http://localhost:3001/preview e http://localhost:3001/barbearia-demo (booking), 3005 (landing), 3343 (painel).
- Visual atual: Arial de sistema, um único azul `#1D4ED8`, `globals.css` só com `prefers-color-scheme`,
  `docs/design-tokens.md` marcado "provisório". Zero elemento-assinatura. = a "cara de template" que o AGENTS §6 proíbe.
- Débito conhecido: `agenda-booking-ui/components/booking/StepSlot.tsx:188` usa `no-scrollbar` sem definição em `globals.css` (barra nativa no tema escuro).

## Skill por passo (novas, instaladas em `~/.gemini/config/skills`)

### T4 — Frontend Engineer (dono do visual)
1. `prototype` — decidir o elemento-assinatura (régua de horários / calendário do booking) em HTML descartável, ANTES de mexer no app.
2. `grill-with-docs` — fechar a identidade: 4–6 cores nomeadas com hex, 2 famílias tipográficas, escala 14/16/20/28/40/64, raios 6/12/16.
3. `codebase-design` + `domain-modeling` — vocabulário comum para os componentes compartilhados.
4. Escrever `docs/design-tokens.md` FINAL e `app/globals.css` com tokens em `:root` **e `.dark` explícito** (parar de depender só do SO).
5. `implement` + `tdd` — aplicar em `ui/` (button/card/input) e propagar. Corrigir `StepSlot.tsx:188`.
6. `writing-for-agents` — deixar os tokens/componentes legíveis para os outros agentes consumirem.
7. Provar no navegador (skill `agent-browser`): screenshot 375 e 1280, claro e escuro, console sem erro.
   Fechar com `lint`/`typecheck`/`test` verdes.

### T5 — Product/Conversion Designer
1. `grilling` — a oferta em uma frase: "Seu cliente agenda sozinho, paga o sinal por Pix e você para de perder horário."
2. `to-spec` → `to-tickets` — virar a landing/onboarding em spec e tickets (evita construir "bonito" sem conversão).
3. `prototype` — hero com UMA sequência de entrada; preço R$49/R$79 de `docs/PRECOS.md`; CTA que diz o que acontece ("Começar grátis", não "Enviar").
4. Usar os tokens de T4 — NÃO criar design system paralelo.
5. `writing-for-agents` — copy pt-BR sentence case, língua do dono ("horários", "clientes", "sinal").

### T6 — UX/UI Auditor
1. `triage` — classificar cada achado.
2. `code-review` (eixo Standards) — checar contra `AGENTS.md` §6 e `docs/design-tokens.md`.
3. `diagnosing-bugs` — só quando o achado for difícil de reproduzir.
4. `to-questionnaire` / `wait-what` — quando o pedido chega ambíguo, devolver pergunta em vez de chutar.
5. Reportar com arquivo:linha + viewport + screenshot, `BLOQUEIA/MELHORAR/OK`. NUNCA reescrever o código dos autores.

## Ordem (dependências)
T4 (tokens) → T5 (landing usa tokens) em paralelo com T6 auditando o booking atual.
`StepSlot.tsx:188` é independente e pode ir primeiro (é bug, não redesign).

## Definição de pronto (visual)
- [ ] `design-tokens.md` final + `globals.css` com `.dark` próprio.
- [ ] Elemento-assinatura implementado e visível.
- [ ] 375px primeiro, sem overflow; desktop depois.
- [ ] Estados carregando/vazio/erro/sucesso em toda tela que busca dado.
- [ ] Alvos ≥44px, foco visível, labels, `prefers-reduced-motion` respeitado.
- [ ] Screenshot 375/1280, claro/escuro, console limpo.
- [ ] `lint`/`typecheck`/`test` verdes + revisor designado.

## Limite de entrega
Esta sessão Hermes NÃO tem canal Maestri (`MAESTRI_SOCKET not set`), então não conectei os terminais.
O encaminhamento a T4/T5/T6 cabe ao Maestri/Codex. Não toquei em nenhuma worktree de frontend.
