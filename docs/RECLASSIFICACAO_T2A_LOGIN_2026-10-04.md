# Reclassificação T6 — Login do Painel T2-A (`7175251`)

- **Data**: 2026-10-04T17:01:00-03:00
- **Auditor**: T6 — Prisma (UX/UI Auditor)
- **Worktree**: `agenda-ux-audit` (`feat/ux-audit` @ `a134216`)
- **Entrega Auditada**: T2-A (CODEXADO) em `agenda-dashboard` (`feat/dashboard` @ commit `7175251`)
- **Escopo**: `components/dashboard/login-form.tsx:8`, `components/dashboard/login-form.module.css:1-60`, `docs/T2-A_LOGIN.md`, rota real `http://localhost:3343/dashboard/login`, testes E2E Playwright `tests/e2e/dashboard-login.spec.ts`.
- **Classificação Anterior**: **BLOQUEIA** (descompasso visual com formulário cru em relação a `/login` oficial).
- **Nova Classificação**: **OK** (aprovado 100%).

---

## 1. Verificação Técnica e Visual do Delta

### 1.1 Identidade Visual e Tokens T4-A (`538f6a3`)
- **Tipografia**: Título `"Entre no seu painel"` aplicando Plus Jakarta Sans (`var(--font-display)` com fallback Inter/system-ui).
- **Paleta de Cores e Contraste**:
  - Botão submit pill: `#c0f739` (`rgb(192, 247, 57)`) com texto escuro `#111613` (contraste **14.46:1**, WCAG AAA).
  - Ícone de marca ("A"): verde floresta `#0f3b2e` com texto lime `#c0f739`.
  - Superfície do card: `#ffffff` no tema claro e `#141f1a` (`rgb(20, 31, 26)`) no tema escuro.
- **Harmonia**: O formulário agora é perfeitamente coerente com o design system Neo-Editorial oficial de `/login` (`agenda-conversion`).

### 1.2 Responsividade Mobile (375px e 390px) e Desktop (1280px)
- Zero overflow horizontal (`scrollWidth <= clientWidth` == true em todos os viewports).
- Alvos de toque acessíveis:
  - Input de email: altura de 48px (`min-h-12`).
  - Botão submit: altura de 48px (`min-h-12`).
  - Link de retorno "Agenda, início": alvo de 44px.

### 1.3 Acessibilidade e Estados
- Suporte a tema escuro/claro nativo via `prefers-color-scheme` e classes explícitas `.dark`/`.light`.
- Foco visível preservado e navegação por teclado (`Tab`) entre cabeçalho, input e botão.
- Label acessível associado (`<label htmlFor="email">Seu email</label>`).
- Estados de envio (pending, erro e sucesso) devidamente protegidos.

### 1.4 Quality Gates do Autor (Verificados)
- `pnpm lint`: exit 0.
- `pnpm typecheck`: exit 0.
- `pnpm test`: 79/79 testes verdes.
- `pnpm build`: Next 16.3.8 produção compilado com sucesso.
- Playwright E2E: 8/8 testes verdes em `tests/e2e/dashboard-login.spec.ts`.

---

## 2. Bloqueio Real Remanescente (Fora do Escopo Visual de T6)
- **Status do Bloqueio Visual**: **0 BLOQUEIOS VISUAIS**.
- **Observação Operacional/Backend**: Como o próprio autor e o coordenador registraram, os testes de envio foram interceptados no cliente/mock; a entrega de e-mail e persistência real dependem de infraestrutura SMTP e sessão/backend B-02 no `:3000`. Não há pendências na camada de interface/CSS.
