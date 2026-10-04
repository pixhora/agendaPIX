# Verificação Rota a Rota — UX/UI e Acessibilidade (T6 Prisma)

- **Data**: 2026-10-04T12:00:00-03:00
- **Agente**: Prisma (T6 — UX/UI Auditor)
- **Worktree**: `/var/home/matheus/projetos/agenda-ux-audit` (`feat/ux-audit`)
- **Metodologia**: Auditoria estrita somente leitura com `agent-browser` em viewports 375px e desktop 1280px, temas claro/escuro, verificação de alvos de toque ≥44px, overflow horizontal (`scrollWidth <= clientWidth`), acessibilidade de foco e `prefers-reduced-motion`.

---

## 1. Tabela Consolidada de Rotas

| # | Caminho / Rota | Método | Status HTTP | Comportamento Observado | Alvos ≥44px | Overflow 375px | Problema (arquivo:linha) | Classificação |
|---|---|---|---|---|---|---|---|---|
| 1 | `http://127.0.0.1:3005/` (Landing) | GET | 200 OK | Layout Neo-Editorial, hero, pain/solution, pricing e footer íntegros. | OK (44px-50px) | Zero (360/360px) | `components/landing/LandingHeader.tsx:50`: quebra de linha visual "Começar \n grátis" no mobile <360px (mitigado para 1 linha a 320px). | **OK** |
| 2 | `http://127.0.0.1:3005/login` (Login Oficial) | GET | 200 OK | Card centralizado, input email 50px, botão submit 48px, link onboarding. | OK (48px-50px) | Zero (375/375px) | Nenhum no layout de T5. | **OK** |
| 3 | `http://127.0.0.1:3005/onboarding` (Onboarding) | GET | 200 OK | Fluxo de 4 passos com validação inline, slug input com `min-w-0`, botões pill. | OK (48px-50px) | Zero (375/375px) | Nenhum no fluxo de T5. | **OK** |
| 4 | `http://127.0.0.1:3001/preview` (Hub Preview) | GET | 200 OK | Lista de módulos de preview Studio Bella, links e cards acessíveis. | OK (44px) | Zero (360/360px) | Nenhum. | **OK** |
| 5 | `http://127.0.0.1:3001/preview/booking` (Booking Preview) | GET | 200 OK | Fluxo determinístico completo (serviço, horário, dados, QR code Pix e confirmação). | OK (48px-120px) | Zero (360/360px) | Nenhum. | **OK** |
| 6 | `http://127.0.0.1:3001/preview/dashboard` (Painel Preview) | GET | 200 OK | Resumo do dia, métricas de sinal Pix, navegação em grade e botão copiar link. | OK (44px) | Zero (360/360px) | Nenhum. | **OK** |
| 7 | `http://127.0.0.1:3001/preview/reservas` (Reservas Preview) | GET | 200 OK | Lista de agendamentos, botão WhatsApp expandido full-width no mobile. | OK (44px) | Zero (360/360px) | Filtro de abas ("Aguardando Sinal") corta levemente à direita em 375px se não houver scroll horizontal evidente (`app/preview/reservas/page.tsx:73`). | **MELHORAR** |
| 8 | `http://127.0.0.1:3001/preview/servicos` (Serviços Preview) | GET | 200 OK | Cards verticais fluidos, preços em centavos claros e alvos de edição. | OK (44px) | Zero (360/360px) | Nenhum. | **OK** |
| 9 | `http://127.0.0.1:3001/preview/configuracoes` (Configurações Preview) | GET | 200 OK | Formulário de horários e card "Recebimento de Pagamentos Pix". | OK (44px) | Zero (360/360px) | Nenhum. | **OK** |
| 10 | `http://127.0.0.1:3001/[slug]` (ex: `/studio-bella`) | GET | 200 OK | Sem banco backend seedado na porta 3001, renderiza estado de erro amigável. | OK (44px) | Zero (375/375px) | Estado de erro com botão "Tentar novamente" (`components/booking/BookingFlow.tsx:55`). Sem crash de tela em branco. | **OK** |
| 11 | `http://127.0.0.1:3343/dashboard/login` (Login Painel T2) | GET | 200 OK | Formulário técnico inline com botão azul e fundo navy (`#0B132B`). | OK (48px) | Zero (375/375px) | `components/dashboard/login-form.tsx:8`: visual cru descompassado do design system Neo-Editorial oficial de `/login` (`app/login/page.tsx:11`). | **BLOQUEIA** |
| 12 | `http://127.0.0.1:3343/dashboard/(owner)/*` | GET | Redireciona 302 -> `/dashboard/login` | Protegido por `requireOwner()`. Exige sessão autenticada. | OK | Zero | Rota de autenticação possui dependência cruzada de Better Auth origin (`BETTER_AUTH_URL`). | **OK** (esperado por segurança) |
| 13 | `http://127.0.0.1:3343/dashboard/customers` (Clientes T2) | GET | 200 OK (com sessão) | Lista de clientes com links `Ligar` e `WhatsApp` (`wa.me`). | OK (44px) | Zero (375/375px) | Aprovado no delta `f4b4361`. | **OK** |
| 14 | `http://127.0.0.1:3343/dashboard/services` (Serviços T2) | GET | 200 OK (com sessão) | Menu mobile flutuante `position: absolute`, formulário de criação/edição. | OK (44px) | Zero (375/375px) | Aprovado no delta `daf70ee`. | **OK** |

---

## 2. Detalhamento dos Problemas Identificados

### 1. [BLOQUEIA] Descompasso e Duplicação Visual de Login
- **Arquivo/Linha**: `agenda-dashboard/components/dashboard/login-form.tsx:8` vs `agenda-conversion/app/login/page.tsx:11`
- **Problema**: A rota `/dashboard/login` renderiza um formulário técnico em dark mode cru com botão azul claro e tipografia básica, enquanto a rota canônica `/login` renderiza o design system oficial Neo-Editorial completo (logo "A Agenda", card elevado, alvos táteis e cores de marca).
- **Impacto**: Experiência fragmentada e amadora caso o dono do negócio caia no `/dashboard/login`.
- **Recomendação**: Unificar na rota canônica `/login` ou fazer `/dashboard/login` importar o componente oficial de T5.

### 2. [MELHORAR] Filtro de Abas no Histórico de Reservas do Preview
- **Arquivo/Linha**: `agenda-booking-ui/app/preview/reservas/page.tsx:73-113`
- **Problema**: Em tela mobile estreita (375px), as 3 abas de filtro somam 369px e a última aba ("Aguardando Sinal") encosta na margem direita sem indicador visual de rolagem horizontal suave.
- **Impacto**: Usuário mobile pode não perceber que a lista pode rolar para o lado.
- **Recomendação**: Adicionar fade sutil na borda direita do contêiner de abas ou empilhar em grade de 3 colunas compactas.

---

## 3. Conclusão da Auditoria Rota a Rota
- **Aderência Mobile 375px**: 100% das rotas auditadas apresentam `scrollWidth <= clientWidth` (zero overflow horizontal).
- **Alvos de Toque**: 100% dos botões e links interativos atingem ou superam a especificação mínima de 44px (`min-h-11` / `min-h-12`).
- **Estados Visuais**: Skeletons, erros com botão de retry e confirmações com animações contidas e acessíveis (`prefers-reduced-motion`).
