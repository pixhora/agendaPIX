# Relatório de Auditoria UX/UI — Prisma (T6)

- **Data**: 2026-10-04T09:45:00-03:00
- **Agente**: Prisma (T6 — UX/UI Auditor)
- **CWD**: `agenda-ux-audit`
- **Branch**: `feat/ux-audit`
- **Commit**: `a134216`
- **Estado Global UX/UI**: **PARCIAL**
- **Quality Gates Executados**: 208 testes unitários/integração verdes (62 booking-ui, 73 conversion, 73 dashboard). Zero código de produto alterado por T6.

---

## 5 Pendências Priorizadas da Interface

### 1. [BLOQUEIA] Duplicação de rotas de login com descompasso visual
- **Arquivos/Linhas**: `agenda-dashboard/components/dashboard/login-form.tsx:8` vs `agenda-conversion/app/login/page.tsx:11`
- **Reprodução**: Rota `/dashboard/login` renderiza form técnico cru inline sem marca, botão azul claro e tema descompassado. Rota `/login` renderiza o design system oficial Neo-Editorial com header, card centralizado, input acessível `min-h-12` e botão pill verde `min-h-12`.
- **Impacto**: Ruptura visual para o dono do negócio e descompasso entre fluxos de autenticação.
- **Dono**: T2 / T5.
- **Dependência**: Rota canônica e configuração de auth origin (`BETTER_AUTH_URL`).
- **Critério de Pronto**: Rota unificada/canônica com layout Neo-Editorial oficial, tokens de marca consistentes e estados acessíveis.

### 2. [BLOQUEIA] Ausência de link direto wa.me na gestão de clientes do painel
- **Arquivo/Linha**: `agenda-dashboard/app/dashboard/(owner)/customers/page.tsx:10`
- **Reprodução**: Lista de clientes no painel do dono oferece apenas link `tel:`, sem link direto `wa.me` pré-formatado exigido no fluxo crítico 4 do AGENTS.md.
- **Impacto**: O cliente-alvo (dono de salão/barbearia) vive no WhatsApp e perde canal prioritário de cobrança manual e lembrete.
- **Dono**: T2.
- **Dependência**: Nenhuma (helpers de link WhatsApp já existem em preview).
- **Critério de Pronto**: Botão de WhatsApp acessível (`min-h-11`, alvo >=44px) ao lado do telefone, com link `wa.me` pré-preenchido.

### 3. [MELHORAR] Descompasso de StepBusiness entre branches
- **Arquivos/Linhas**: `agenda-booking-ui/components/onboarding/StepBusiness.tsx:83` vs `agenda-conversion/components/onboarding/StepBusiness.tsx:114`
- **Reprodução**: A branch `feat/booking-ui` ainda contém cópia de `StepBusiness.tsx` sem `min-w-0` no campo de slug, causando transbordo horizontal de 36px em viewport 375px se renderizada por lá. Em `feat/conversion` o componente já possui `min-w-0` e alvos de 48px.
- **Impacto**: Risco de regressão no merge final caso a versão desatualizada sobrescreva a versão corrigida de T5.
- **Dono**: T4 / Coordenação de merge.
- **Dependência**: Branch `feat/conversion`.
- **Critério de Pronto**: Remoção de duplicações desnecessárias ou sincronização integral com a versão corrigida de T5.

### 4. [MELHORAR] Ausência de feedback em rotas públicas sem banco local
- **Arquivo/Linha**: `agenda-booking-ui/app/[slug]/page.tsx`
- **Reprodução**: Acesso a `/[slug]` fica em loading infinito ou tela vazia se o banco backend local não tiver dados do negócio correspondente.
- **Impacto**: Experiência quebrada fora do `/preview/*` durante testes manuais rápidos.
- **Dono**: T4.
- **Dependência**: Tratamento de erro 404 amigável.
- **Critério de Pronto**: Estado de erro mobile 375px claro ("Estabelecimento não encontrado") com link de retorno ou suporte.

### 5. [OK] Animações e micro-interações compartilhadas (A1/A2/A3)
- **Commits**: `88a4d49` (booking-ui), `daf70ee` (dashboard), `3ac321b` (conversion).
- **Evidência**: Tokens 120ms/180ms/240ms e `@media (prefers-reduced-motion: reduce)` rigorosamente aplicados. Menu mobile em painel flutuante absoluto sem CLS. Foco por teclado (`Escape`/`Tab`) retido.
- **Classificação**: OK (aprovado 100%).
