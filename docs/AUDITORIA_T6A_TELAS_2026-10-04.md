# Relatório de Auditoria T6-A — Auditoria por Tela com Evidência

- **Data**: 2026-10-04T16:41:00-03:00
- **Auditor**: T6 — Prisma (UX/UI Auditor)
- **Worktree**: `/var/home/matheus/projetos/agenda-ux-audit`
- **Branch**: `feat/ux-audit`
- **Commit Base**: `a134216`
- **Ambiente Auditado**: Stack local ativa via `run_system.py` (3000 Backend, 3001 Booking/Preview, 3005 Landing/Conversion, 3343 Painel).
- **Viewports Verificados**: Mobile 390x844 (Portal Maestri) e Desktop 1280x800.
- **Evidências Geradas**: 18 screenshots salvos em `docs/evidencias/t6-a-portal/`.

---

## 1. Tabela de Auditoria por Rota

| # | Rota / Tela | Porta | Viewport | Status | Alvo ≥44px | Overflow Horizontal | Problema Identificado (arquivo:linha) | Classificação |
|---|---|---|---|---|---|---|---|---|
| 1 | `/` (Landing) | 3005 | 390 & 1280 | 200 OK | OK (44–50px) | Zero (`scrollWidth: 375px <= clientWidth: 375px`) | Header com botão "Começar grátis", hero sem fade-up repetido, tipografia Neo-Editorial. Nenhum bloqueio. | **OK** |
| 2 | `/login` (Login Oficial) | 3005 | 390 & 1280 | 200 OK | OK (input 50px, submit 48px) | Zero (`scrollWidth: 390px`) | Card centralizado, foco visível, botão pill verde `#C0F739`. | **OK** |
| 3 | `/onboarding` (Onboarding) | 3005 | 390 & 1280 | 200 OK | OK (inputs e botões 48–50px) | Zero (`scrollWidth: 390px`) | Validação inline sem layout shift, slug input com `min-w-0` e `shrink-0`. | **OK** |
| 4 | `/barbearia-demo` (Booking Real) | 3001 | 390 & 1280 | 200 OK | OK (cards 96px, slots 44px, botões 48px) | Zero (`scrollWidth: 390px`) | Régua de dias e horários real com dados do seed. `StepSlot.tsx:188` corrigido com utilitário `.no-scrollbar` em `globals.css:160` (sem barra feia no mobile/desktop). | **OK** |
| 5 | `/preview/reservas` | 3001 | 390 & 1280 | 200 OK | OK (links e botões ≥44px) | Zero (`scrollWidth: 375px`) | Resolvido no commit `538f6a3` de T4: `PreviewNav.tsx:28` agora usa grid 2 colunas responsivo, eliminando corte de abas. | **OK** |
| 6 | `/preview/dashboard` | 3001 | 390 & 1280 | 200 OK | OK (44px) | Zero (`scrollWidth: 375px`) | Cartões de métricas em centavos e links íntegros. | **OK** |
| 7 | `/preview/servicos` | 3001 | 390 & 1280 | 200 OK | OK (44px) | Zero (`scrollWidth: 375px`) | Cards verticais fluidos com alvos acessíveis. | **OK** |
| 8 | `/preview/configuracoes` | 3001 | 390 & 1280 | 200 OK | OK (44px) | Zero (`scrollWidth: 375px`) | Navegação consistente via `PreviewNav`. | **OK** |
| 9 | `/dashboard/login` | 3343 | 390 & 1280 | 200 OK | OK (submit 48px, input 48px) | Zero (`scrollWidth: 390px`) | **Revalidação de T2**: Redesenhado no commit `9e24951`! Card elevado, logo "Agenda", botão pill `#C0F739` idêntico ao `/login` de T5. O descompasso visual anterior foi totalmente sanado. | **OK** |
| 10 | `/dashboard/(owner)/*` (Shell Mobile) | 3343 | 390 & 1280 | 200 OK (com sessão) | OK (44px) | Zero (`scrollWidth: 390px`) | **Revalidação T2 commit b7ad242**: Navegação mobile agora exposta diretamente em grid 2 colunas (`shell.tsx:32`, `navigation.tsx:11`), sem menu colapsado escondido. | **OK** |
| 11 | `app/globals.css` (Tokens .dark) | 3001 | 390 & 1280 | CSS compilado | N/A | N/A | **Achado**: Em `agenda-booking-ui/app/globals.css:35`, a classe `.dark` define variáveis CSS, mas a diretiva `@custom-variant dark (&:where(.dark, .dark *));` no Tailwind v4 exige aplicação de `.dark` no elemento HTML e que o layout adicione a classe no SSR ou cliente para alternância explícita. | **MELHORAR** |

---

## 2. Síntese dos Achados

### Classificação Geral
- **BLOQUEIA**: 0 (zero bloqueios encontrados; o bloqueio anterior de descompasso de login foi corrigido por T2 em `9e24951`).
- **MELHORAR**: 1
  - **`agenda-booking-ui/app/globals.css:35` / `app/layout.tsx:24`**: Adicionar suporte a alternador de tema explícito ou sincronização com atributo `class="dark"` no elemento `<html>` para garantir que o modo escuro funcione além do `prefers-color-scheme`.
- **OK**: 9 telas e componentes auditados com total aprovação (landing, login, onboarding, booking público real, régua de slots, preview completo, shell do dashboard e tela de login do painel).

---

## 3. Arquivos de Evidência
Todas as capturas registradas em resolução real encontram-se em:
`/var/home/matheus/projetos/agenda-ux-audit/docs/evidencias/t6-a-portal/`
- `landing-390.png` e `landing-1280.png`
- `login-390.png` e `login-1280.png`
- `onboarding-390.png` e `onboarding-1280.png`
- `booking-barbearia-390.png` e `booking-barbearia-1280.png`
- `dashboard-login-390.png` e `dashboard-login-1280.png`
- `preview-reservas-390.png` e `preview-reservas-1280.png`
- `preview-dashboard-390.png` e `preview-dashboard-1280.png`
- `preview-servicos-390.png` e `preview-servicos-1280.png`
- `preview-config-390.png` e `preview-config-1280.png`
