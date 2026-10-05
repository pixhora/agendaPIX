# PLANO OPERACIONAL — agenda online + sinal por Pix

Autor da coordenação: Hermes (Operação e Performance). Data: 2026-10-04.
Fonte única da execução. Cada agente lê apenas a sua linha, as dependências diretas e a Definição de Pronto. Supervisão: Maestri/Codex. Sem merge/push/deploy.

## Ordem de prioridade

1. Bloqueadores do primeiro cliente pagante.
2. Jornada real completa (booking -> sinal -> confirmação; onboarding -> painel).
3. Beleza/performance/consistência — SÓ com problema comprovado (nada de redesign genérico).
4. Verificação contínua (QA/auditoria) conforme as entregas chegam.

## Bases (commit-base observado)

| Área | Worktree | Branch | Base |
|---|---|---|---|
| Backend, auth, tenant, Pix | agenda-backend | feat/backend | 0d6858f |
| Painel do dono | agenda-dashboard | feat/dashboard | f4b4361 |
| Booking, Preview, design system | agenda-booking-ui | feat/booking-ui | 8c0237d |
| Landing, onboarding, conversão | agenda-conversion | feat/conversion | 3ac321b |
| QA, E2E, regressão | agenda-tests | feat/tests | ecc62d9 |
| Auditoria UX/UI | agenda-ux-audit | feat/ux-audit | a134216 |
| Revisão técnica | agenda-review | feat/review | d462419 |

Regras: nunca rebase/limpe árvore suja; nunca edite trabalho alheio; reunir em commit identificado.

## Regras de trabalho (obrigatórias)

- Um autor por arquivo. Dependência só inicia depois da entrega revisada do pré-requisito.
- Mudança pequena e reversível na worktree do dono. Reusar código existente; sem dependência nova sem justificativa de uma linha.
- Gates antes de declarar pronto: `lint`, `typecheck`, `test`; `build` quando pertinente; `test:db`/E2E quando tocar dinheiro/tenant.
- Revisor classifica `BLOQUEIA` / `MELHORAR` / `OK` com arquivo:linha e evidência; NUNCA reescreve o código do autor.
- Sem merge/push/deploy, sem destruição de dados, sem cobrança real, sem segredo em prompt/log.
- Reportar por arquivo + checkpoint. Resultados ao Hermes na nota "Hermes — contexto e auditoria" e na fila do coordenador.

## Definição de Pronto (anti-falha boba)

- [ ] Verificado em mobile 375px E desktop, sem overflow horizontal.
- [ ] Estados completos quando a tela busca dados: carregando (skeleton), vazio, erro (diz o que houve), sucesso.
- [ ] Alvos de toque >= 44px; foco de teclado visível; labels em todos os campos; `prefers-reduced-motion` respeitado.
- [ ] Dinheiro em centavos inteiros; input validado com Zod no servidor; autorização por tenant em toda query.
- [ ] Sem `console.log` esquecido; sem TODO sem dono; sem segredo em código/log; texto pt-BR, sem jargão.
- [ ] Teste proporcional passando; procedimento de reversão descrito; revisor designado.
- [ ] Pix `fake` sempre identificado como simulação; NUNCA apresentar como recebimento real.

## Fase 0 — Bloqueadores

| ID | Dono | Arquivos / alvo | Dep | Invariantes | Critério observável | Testes / Revisor / Reversão | Status |
|---|---|---|---|---|---|---|---|
| B-01 | T1 (Codex) | lib/auth.ts:16, app/api/auth/[...all]/route.ts:10 | — | resposta e sessão corretas; sem token/SQL/PII/stack | falha SMTP+adapter pelo handler real não vaza marcador | reviewer-auth-error.test.ts / Codex Revisor + T3 / revert commit | pronto (entrega por nota) |
| B-02 | T1 + Cursor | definir autoridade de processo: qual Next aplica auth/webhook/reserva; remover cópias divergentes de auth/pagamento | B-01 | contrato único; fake bloqueado em produção | um servidor aplica webhook/reserva; demais consomem | proposta Cursor / Cursor + Codex Revisor / revert | APROVADO — T1 passo 1 |
| B-03 | T1 + T2 | app/api/businesses/[businessId]/pix-key/route.ts (T1) + consumo do painel (T2) | B-02 | só type/hint; ciphertext fora da resposta/log | PUT/GET/DELETE do dono; alheio 404; same-origin | revisão HTTP/T3 / Codex Revisor / revert | bloqueado (dep B-02) |
| B-04 | humano/T1 | gateway real (Asaas/MP) + SMTP real | decisão/credenciais do humano | fake nunca vira dinheiro | cobrança sandbox + webhook idempotente confirma; link mágico único | sandbox / T3 / — | bloqueado (decisão/credenciais) |
| B-05 | T2 | 3343 servir + prova integrada (login/CRUD/browser) | — | sem relaxar segurança | /dashboard/login 200; CRUD real em banco sintético | browser sintético / T3 / parar processo próprio | em andamento |
| B-06 | T3 | QA integrado ponta a ponta (booking+painel+onboarding) | B-05 + URLs/DB sintético | sem bypass de sessão | jornada 375/1280 sem skip; pending até webhook | Playwright / self / — | bloqueado (fila) |

## Fase 1 — Jornada real completa

| ID | Dono | Arquivos / alvo | Dep | Critério observável | Status |
|---|---|---|---|---|---|
| F-01 | T5 | components/onboarding/StepAccount.tsx:43 (persistir negócio/serviço) | API onboarding T1 | dados do onboarding persistem para o tenant | bloqueado (dep T1) |
| F-02 | T2 + T5 | canonizar login único (/dashboard/login vs /login) | decisão de integração | rota única com design oficial, tokens e a11y | bloqueado (decisão) |
| F-03 | T4 | app/[slug]/page.tsx, BookingFlow.tsx (retomada de sessão Pix) | — | ENTREGUE commit 8c0237d — prova pendente de arquivo | andamento (falta prova) |
| F-04 | T4 | BookingFlow.tsx:58, StepSlot.tsx:129 (timeout AbortController) | — | timeout 10s -> tela de erro com "Tentar novamente" | pronto |
| F-05 | T4 | package.json:17 (sync .next/static -> standalone) | — | standalone serve chunks sem cópia manual | pronto |
| F-06 | T2 | operação de clientes/reservas/dados do negócio | contrato T1 + priorização humana | escopo comercial delimitado | bloqueado (decisão) |

## Fase 2 — Beleza/performance (problema comprovado)

| ID | Dono | Arquivos / alvo | Critério | Status |
|---|---|---|---|---|
| P-01 | T4 + T2 | dashboard globals.css:6 (azul #1d4ed8 vs lime do design) | identidade coerente 375/desktop claro/escuro; contraste/foco/toque | bloqueado (dep pacote de tokens/acordo) |
| P-02 | T4 | navegação/foco booking + menu do painel (A1/A2/A3) | aprovado | concluído |
| P-03 | T6 | revalidar cada entrega visual 375/desktop/estados/a11y | achados com arquivo:linha | em andamento |

## Fase 3 — Verificação

- A-01 T6: auditar entregas conforme chegam (visual/a11y). A-02 T3: incorporar regressões versionadas.
- A-03 Codex Revisor: revalidar B-01 e rotas pix-key. A-04 Cursor: revisão de integração após B-02.

## Fluxo de relatório

1. Autor implementa, roda gates, commita, escreve relatório em docs/ da sua worktree.
2. Revisor designado aponta `BLOQUEIA`/`MELHORAR`/`OK`. Bloqueio impede integrar, não impede tarefa independente.
3. Hermes consolida em checkpoint e reporta ao coordenador. Integração final é do humano.

## B-02-D — DECISÃO (APROVADA pelo humano em 2026-10-04)

Pergunta: adotar UM processo autoridade — Next do `agenda-backend` (3000) — para auth, webhook, reserva e chave Pix, e converter dashboard/booking-ui/conversion em UI que consome o backend?

Recomendação (Cursor): SIM.

Efeito se aprovado: T1 publica URL do backend + lista de origens; T2/T4/T5 apontam login/reserva/pix-key para o backend e depois removem as cópias locais (`app/api/auth`, `app/api/public`, `app/api/webhooks`, `lib/auth.ts`, `lib/payments`); T3 prova 404 das cópias + um webhook/uma reserva + handler sem token/SQL/email; `scripts/run_system.py:149` deixa de setar `BETTER_AUTH_URL` por processo. B-01 (logger seguro) continua obrigatório no processo autoridade.

Critério: um processo recebe o webhook e cria a reserva; os outros três respondem 404; painel grava chave no backend e recebe só type/hint; fake recusado em produção.

Riscos: webhook duplicado na transição (idempotência cobre, mas cópia sem logger vaza); cookie de sessão preso ao host errado; apagar API local cedo derruba Preview/landing.

Reversão: marcar commit de cada worktree antes de apagar; reverter = restaurar os arquivos.

Cadeia pós-aprovação: (1) T1 publica URL+origens e faz B-01; (2) T2/T4/T5 apontam consumo; (3) T3 prova 404 + webhook único; (4) T2/T4/T5 removem cópias; (5) Cursor revalida (A-04).

## Limites

Sem risco zero. Gateway real, SMTP, LGPD, trial/assinatura e canonização de login são decisões do humano; não inventar. Preview e Pix fake nunca valem como produção.
