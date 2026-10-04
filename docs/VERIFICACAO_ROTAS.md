# Verificação Rota a Rota — Área T4 (Booking UI & Preview)

**Data:** 2026-10-04  
**Agente:** Antigravidade (T4)  
**Worktree:** `/var/home/matheus/projetos/agenda-booking-ui`  
**Branch:** `feat/booking-ui` (`5b4c3ad`)  
**Modo:** Somente Leitura (nenhum código alterado)

---

## Tabela de Rotas Auditadas

| Rota | Método | Status HTTP | Comportamento Observado | Problema Identificado (arquivo:linha) | Classificação |
|---|---|---|---|---|---|
| `/[slug]` | GET | 200 | Renderiza `BookingFlow`. Client component busca `/api/public/[slug]/services`. Mostra skeleton e em seguida formulário de agendamento (ou card de erro caso negócio inexista/falhe). | [BookingFlow.tsx:63](file:///var/home/matheus/projetos/agenda-booking-ui/components/booking/BookingFlow.tsx#L63) — Se slug for inexistente no banco, a API retorna 404, mas a página HTTP responde 200 com card de erro em tela ("Estabelecimento não encontrado") em vez de `notFound()` HTTP 404 nativo do Next.js SSR. | **MELHORAR** |
| `/preview` | GET | 200 | Hub central com 6 cards de navegação para todas as áreas determinísticas. Totalizador de faturamento e sinais mockados. | Nenhum problema funcional. Links e renderização 100% íntegros. | **OK** |
| `/preview/booking` | GET | 200 | Fluxo completo do cliente com dados fixos de "Studio Bella". Passos 1 a 4 funcionais, simulação de Pix instantâneo, QR SVG mockado e tela de confirmação. | Nenhum problema funcional. 100% determinístico e utilizável. | **OK** |
| `/preview/dashboard` | GET | 200 | Painel do dono com KPIs do dia (R$ 440 previstos, R$ 100 sinais), timeline e botão de cópia de link de agendamento. | [app/preview/dashboard/page.tsx:20](file:///var/home/matheus/projetos/agenda-booking-ui/app/preview/dashboard/page.tsx#L20) — Fallback SSR de cópia gera URL fictícia `https://agenda.com.br/studio-bella`. No cliente copia `origin/preview/booking`. | **MELHORAR** |
| `/preview/reservas` | GET | 200 | Tabela e cards de agendamentos do dia (Camila, Juliana, Beatriz), filtros por status (todas/confirmadas/pendentes) e links de WhatsApp. | [app/preview/reservas/page.tsx:40-65](file:///var/home/matheus/projetos/agenda-booking-ui/app/preview/reservas/page.tsx#L40-L65) — Subnavegação do painel possui cópias manuais de links em cada página em vez de layout compartilhado do preview. | **MELHORAR** |
| `/preview/servicos` | GET | 200 | Catálogo dos 4 procedimentos do Studio Bella com duração, preço total e sinal de Pix configurado. | Nenhum problema. Renderização estática pura e sem erros. | **OK** |
| `/preview/configuracoes` | GET | 200 | Horários de funcionamento (Terça a Sábado), fuso horário São Paulo, link de agendamento e informações do Studio Bella. | Nenhum problema. Renderização estática consistente com tokens. | **OK** |

---

## Síntese de Auditoria

- **Total de rotas auditadas:** 7
- **Classificação:**
  - **OK:** 4 rotas (`/preview`, `/preview/booking`, `/preview/servicos`, `/preview/configuracoes`)
  - **MELHORAR:** 3 rotas (`/[slug]`, `/preview/dashboard`, `/preview/reservas`)
  - **BLOQUEIA:** 0 rotas que impedem navegação ou operação no momento.
- **Ambiente verificado:** Servidor ativo na porta 3001, todos os retornos HTTP 200 operacionais.
