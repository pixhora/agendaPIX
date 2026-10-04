# Relatório de Refatoração de Frontend T5 (Trilha)

Data: 2026-10-04
Worktree: `agenda-conversion` (`feat/conversion`)
Escopo: Landing (/), Onboarding (/onboarding), Login (/login), Tokens e Integração de Autoridade

## 1. Planos Executados

### T5-A — Landing que Converte
- **Commit**: `3c0e45c`
- Refatoração dos 11 componentes de `components/landing/*`.
- Preços rigorosamente fixados conforme `docs/PRECOS.md`: Plano Base R$ 49/mês (4900 centavos) e Plano Completo R$ 79/mês (7900 centavos) com 7 dias de teste grátis sem cartão.
- Removidos padrões artificiais de template de IA: badges redundantes em CAIXA ALTA com tracking exagerado, numerações falsas `01/02/03` em benefícios e setinhas decorativas.
- Proposta central em destaque editorial: "Seu cliente agenda sozinho, paga o sinal por Pix e você para de perder horário."
- Mobile-first verificado em 375px (alvos ≥44px, sem transbordamento).

### T5-B — Onboarding sem Fricção
- **Commits**: `5a2166e` e `3ac321b`
- Fluxo de 4 passos ágeis: Negócio, Serviço, Horários, Conta.
- Ações com toque imediato ≤3 interações por tela, feedback tátil (120ms), transições suaves (240ms) e respeito a `prefers-reduced-motion`.
- Integração legítima com a autoridade backend `:3000` via `credentials: "include"`, `Idempotency-Key` UUIDv4 preservado no storage entre retries, e tratamento estrito de erros 401, 409 e 503 (sem sucesso falso simulado fora de `/preview`).

### T5-C — Consumo dos Tokens do T4
- Sincronização direta de `app/globals.css` com os design tokens homologados de T4 (`agenda-booking-ui`).
- Suporte a `@custom-variant dark (&:where(.dark, .dark *))` e `:root:not(.light)`.
- Sem criação de design system paralelo.
- Utilitários de transição (`transition-feedback`, `transition-opening`, `transition-step`, `scrollbar-hide`) integrados.

## 2. Qualidade e Verificação Técnica
- `pnpm lint`: 0 erros, 0 warnings
- `pnpm typecheck`: 0 erros
- `pnpm test`: 11 arquivos, 78/78 testes passando
- Visual: `agent-browser` capturou `/tmp/landing-375px.png`, `/tmp/landing-1280px.png`, `/tmp/onboarding-375px.png` e `/tmp/login-375px.png` com viewport intacto e console limpo.
