# PLANO POR AGENTE — rumo ao MVP apresentável

Hermes (Operação/Performance) — 2026-10-04. Complementa `docs/PLANO_OPERACIONAL.md` (não o substitui).
Supervisão: Maestri/Codex. Sem merge/push/deploy. Cada agente lê só a sua linha + dependências diretas.

## 1. Estado verificado (evidência, não opinião)

Comandos: `python3 scripts/run_system.py --check` e GETs diretos em 3000/3001/3005/3343.

- Sistema estava PARADO (última execução terminou em SIGTERM, log `agenda-conversion-98635.log`).
- Relançado: `Backend 3000`, `Preview 3001`, `Landing 3005`, `Painel 3343` — 4/4 HTTP 200.
- `GET /api/health` → 200 `{"status":"ok"}` (liveness).
- `GET /api/ready` → 200 `{"status":"ready"}` (DB + SMTP configurados; sem envio de e-mail).
- `GET /api/public/barbearia-demo/services` → 200, 3 serviços, centavos inteiros (Corte 3500/sinal 1000).
- `GET /api/public/barbearia-demo/availability?serviceId=...&date=2026-10-06` → 200, 18 slots reais.
- Porta 3006 (snapshot estático antigo) e túneis temporários anteriores estão MORTOS.
- `maestri list` indisponível nesta sessão (`MAESTRI_SOCKET not set`): não reporto por canvas.

### URLs apresentáveis agora
- Booking público: http://localhost:3001/barbearia-demo
- Preview interno: http://localhost:3001/preview
- Landing: http://localhost:3005/
- Painel: http://localhost:3343/dashboard/login

## 2. Bloqueadores reais do primeiro cliente pagante

| # | Bloqueio | Evidência | Dona |
|---|---|---|---|
| 1 | Pix só `fake`, nunca pagável | `lib/payments/index.ts:6` recusa produção; copia-e-cola "não pagável" | decisão do humano + T1 |
| 2 | `POST /api/onboarding` AUSENTE | `docs/CONTRATOS.md` F01 "endpoint ainda AUSENTE" | T1 |
| 3 | Painel sem `.env` | `agenda-dashboard/` só tem `.env.example`; `lib/env.ts:7` exige `BETTER_AUTH_SECRET` | T2 |
| 4 | Sem deploy/HTTPS/domínio | P07 pendente | humano |
| 5 | Resend sem domínio verificado | `pedidos.md` fechamento do incidente | T5/humano |
| 6 | Trial/assinatura sem regra aprovada | P06 pendente (R$49/R$79 aprovados em `docs/PRECOS.md`) | humano |

## 3. Planos por agente

Ordem: destravar jornada real → provar ponta a ponta → só então beleza.

### T1 — Backend (agenda-backend)
- B-05 pré-requisito de todos: manter 3000/ready estável e publicado como autoridade única (B-02 aprovado).
- Implementar `POST /api/onboarding` conforme F01 já contratado (transação: negócio+serviço+horários; deriva `ownerId` da sessão; `Idempotency-Key`).
- Não ligar chave Pix do dono ao provider de reserva antes da decisão de recebimento (P09).

### T2 — Painel (agenda-dashboard)
- Criar `.env` local do painel a partir de `.env.example` (segredo próprio, DB existente) e provar login real + um CRUD.
- Consumir a autoridade 3000 para login/pix-key depois de T1 publicar origens; remover cópia local só após prova 404.

### T3 — QA/E2E (agenda-tests)
- Jornada Playwright 375/desktop: escolher serviço → horário → dados → sinal → confirmação, com estado `pending` até webhook.
- Provar: reserva duplicada rejeitada; tenant alheio 404; webhook repetido idempotente.

### T4 — Frontend (agenda-booking-ui)
- Ver `docs/PLANO_TELAS_FRONTEND.md` (design system + telas). É o dono do visual.
- Fechar `StepSlot.tsx:188` (barra de rolagem nativa no tema escuro; `no-scrollbar` sem definição em `globals.css`).

### T5 — Conversão (agenda-conversion)
- Landing/pricing R$49/R$79 e onboarding consumindo F01 quando T1 publicar.
- Homologar domínio Resend antes de abrir cadastro a terceiros.

### T6 — Auditoria UX (agenda-ux-audit)
- Auditar booking 375px e painel com arquivo:linha; revalidar cada entrega visual. `BLOQUEIA/MELHORAR/OK`.

### Cursor (tech lead)
- Revisar B-02 após T1 publicar origens; checar cookie de sessão preso ao host e webhook duplicado na transição.

### Hermes (Operação/Performance) — este terminal
- Entregue: diagnóstico, relançamento do stack local, este plano e o plano de telas.
- Pendente: manter `run_system.py --check` verde; medir peso do mobile no dispositivo real; reportar ao coordenador.

## 4. Definição de pronto (MVP apresentável)
- [ ] 4 serviços de pé com `--check` verde e `/api/ready` ready.
- [ ] Jornada booking completa provada por T3 em 375px e desktop.
- [ ] Painel com login real (não só a rota).
- [ ] Onboarding persiste negócio/serviço/horários.
- [ ] Pix `fake` SEMPRE rotulado como simulação.
- [ ] `lint`, `typecheck`, `test`, `test:db` verdes.

## 5. Limites
Sem merge/push/deploy, sem cobrança real, sem segredo em log. Gateway real, deploy, LGPD e trial são decisão do humano — não inventar.
