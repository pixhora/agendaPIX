# Auditoria T4 — Frontend Engineer (Booking / Preview / Tokens)

- **Agente:** Antigravidade (T4)
- **Worktree:** `/var/home/matheus/projetos/agenda-booking-ui`
- **Branch:** `feat/booking-ui`
- **Data:** 2026-10-04

---

## 1. Estado por Área

### 1.1 Booking Público Real (`/[slug]`)
- **Estado:** COMPLETO (com simulação na camada Pix em desenvolvimento aguardando gateway real de T1).
- **Implementação:** `BookingFlow.tsx`, `StepProgress.tsx`, `StepService.tsx`, `StepSlot.tsx`, `StepCustomer.tsx`, `StepPayment.tsx`, `BookingConfirmation.tsx`.
- **Estados Visuais:** Loading (skeleton com `aria-busy`), Empty (serviços vazios, slots vazios com orientação de data), Error (503 com retry, 409 conflito de horário), Success (confirmação com resumo, link WhatsApp wa.me e animação `.animate-confirm-pop`).
- **Acessibilidade:** Navegação por teclado (setas em radiogroup de serviços e horários), foco visível, labels acessíveis, contraste AA em modo claro e escuro, `prefers-reduced-motion` zera durações e desativa transformações.
- **Responsividade:** Validado e sem overflow horizontal em 375px e desktop.

### 1.2 Modo Preview (`/preview`, `/preview/booking`)
- **Estado:** COMPLETO.
- **Implementação:** Telas desacopladas para Studio Bella (`/preview`, `/preview/landing`, `/preview/booking`, `/preview/dashboard`, `/preview/reservas`, `/preview/servicos`, `/preview/configuracoes`).
- **Simulação Pix:** Botão explícito "Simulador Pix Pago no Banco" para validação determinística sem requisições de backend.

### 1.3 Design System & Tokens (`globals.css`, `design-tokens.md`)
- **Estado:** COMPLETO.
- **Tokens de Movimento:** `--duration-feedback: 120ms`, `--duration-opening: 180ms`, `--duration-step: 240ms`, `--ease-standard: cubic-bezier(0.16, 1, 0.3, 1)`.
- **Utilitários:** `.transition-feedback`, `.transition-opening`, `.transition-step`, `.animate-step-in`, `.animate-confirm-pop`.
- **Acessibilidade de Movimento:** `@media (prefers-reduced-motion: reduce)` força durações a `0s` e `transform: none !important`.

### 1.4 Painel Real
- Mantido sob responsabilidade exclusiva de T2 (CODEXADO em `agenda-dashboard`). T4 não modifica arquivos de dashboard real.

---

## 2. Testes e Verificação

- **Vitest Unitários:** 8/8 arquivos, 62/62 testes aprovados (`pnpm test`).
- **Typecheck:** 0 erros (`pnpm typecheck`).
- **Lint:** 0 warnings (`pnpm lint`).
- **Playwright `booking-ui.spec.ts`:** 20/20 testes aprovados em 375px/desktop (estados, teclado, radiogroup, máscara, polling, expiração, reduced-motion, contraste AA).
- **Playwright Preview QA:** 10/10 testes aprovados (`preview.spec.ts`, `preview-visual.spec.ts`, `slot-ruler.spec.ts`). Total Playwright: 30/30 testes verdes.
- **Build Standalone:** Build executado com sucesso (`pnpm build`).

---

## 3. Pendências Priorizadas

1. **P1 — Sync automático de `.next/static` para standalone no script de build**
   - **Arquivo:** `package.json:17`
   - **Reprodução:** Rodar `pnpm build && node .next/standalone/server.js` sem cópia manual de `.next/static` resulta em 404 para chunks CSS/JS no standalone.
   - **Impacto:** Médio se deploy rodar standalone direto sem Dockerfile.
   - **Dono:** T4.
   - **Critério de Pronto:** Script `build` ou Dockerfile copiar `.next/static` para `.next/standalone/.next/static`.

2. **P2 — Integração e validação visual do gateway Pix real (Asaas)**
   - **Arquivo:** `components/booking/StepPayment.tsx:55`
   - **Reprodução:** Pagamento opera com provider `fake` até backend plugar Asaas em produção.
   - **Impacto:** Alto para primeiro cliente pagante (dependência de T1).
   - **Dono:** T1 (backend/gateway) + T4 (validação visual na UI).
   - **Critério de Pronto:** QR code real Asaas renderizado e confirmação via webhook transiciona UI para `confirmed`.

3. **P3 — Retomada de sessão Pix ativa caso cliente feche aba e reabra URL**
   - **Arquivo:** `app/[slug]/page.tsx:16` e `components/booking/BookingFlow.tsx:30`
   - **Reprodução:** Se cliente fechar navegador no passo 4 e reabrir `/[slug]`, fluxo reinicia do passo 1.
   - **Impacto:** Médio (cliente precisa refazer agendamento enquanto vaga está pré-bloqueada).
   - **Dono:** T4.
   - **Critério de Pronto:** Persistir `bookingId`/`accessToken` ativo no `sessionStorage` ou permitir `/[slug]?bookingId=...` para retomar contagem e QR code.

4. **P4 — Timeout com `AbortController` em requisições públicas de booking para 3G lento**
   - **Arquivo:** `components/booking/BookingFlow.tsx:58` e `components/booking/StepSlot.tsx:129`
   - **Reprodução:** Queda de rede silenciosa deixa UI em skeleton sem acionar tela de erro.
   - **Impacto:** Médio no mobile com sinal instável.
   - **Dono:** T4.
   - **Critério de Pronto:** Timeout de 10s via `AbortController` disparando tela de erro com botão "Tentar novamente".
