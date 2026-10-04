# PROGRESSO

## Estado inicial

Projeto auditado e backlog criado.

Data: 02/10/2026 (America/Sao_Paulo).
Branch: `feat/backend`.
Commit auditado: `8783cc57b4013639e07ec3d83ce835a9b2a093a4`.
Commit dos documentos: consultar `git log -1 --format=%H -- docs/PROGRESSO.md` (evita autorreferência de hash).
Escopo: worktree agenda-backend; não representa entrega em outras branches.

## Estado atual

Backend: PARCIAL — APIs públicas e reserva funcionais; APIs do painel ausentes.
Banco: COMPLETO no domínio atual — schema e migrations; 25 integrações passam. Seed PARCIAL, execução não auditada.
Frontend: PARCIAL — página provisória, tokens e botão; público/painel/landing/onboarding AUSENTES.
Auth: PARCIAL — link mágico/sessão testados; UI e SMTP real pendentes.
Agendamento: PARCIAL — domínio e concorrência testados; jornada visual ausente.
Pix: MOCK — fake não pagável, bloqueado em produção; webhook PARCIAL com idempotência testada.
Assinatura: AUSENTE — sem trial, cobrança ou controle de acesso.
Testes: PARCIAL — lint/typecheck e 48 unitários, 25 integrados, 2 E2E passaram; E2E não cobre dinheiro real.
Deploy: PARCIAL — compose só Postgres local; aplicação Docker/Coolify/HTTPS ausentes; build falha por EPERM do Turbopack.

## Tarefa em andamento

Nenhuma funcionalidade em andamento nesta execução. Auditoria documental concluída; revisão externa pendente.

## Próximas tarefas

Consultar `docs/backlog.md`.
Terminal 1: B00 — alinhar contratos e execução da base existente.
Terminal 2: D00 — mapear telas aos contratos; implementar após liberação da base.
Terminal 3: Q00 — revisar base e reproduzir bloqueio de build.
Terminal 4: F00 — finalizar identidade/tokens após liberação da base.

## Bloqueios

Build de produção não passou (EPERM na abertura de porta interna); gateway/recebedor real e políticas financeiras pendentes; UI/API do painel ausentes; revisão técnica pendente; branch main ausente; SMTP/deploy/backup e decisões LGPD/assinatura pendentes. Detalhes em backlog e pedidos.

## Validação

`pnpm lint`: passou sem warnings.
`pnpm typecheck`: passou.
`pnpm test`: 48 passaram.
`pnpm build`: falhou nas duas execuções por EPERM; nenhuma correção de produto feita nesta auditoria.
`pnpm test:e2e`: falhou ao iniciar servidor no sandbox; repetição escalonada passou com 2 testes em 375px.
`pnpm test:db`: falhou por conexão EPERM no sandbox; repetição escalonada passou com 25 testes.
Sem push, merge ou desenvolvimento de novas funcionalidades.

## 2026-10-04 — Backend validado e sistema disponível para teste

T1 retomou a auditoria em `feat/backend`, base `0d6858f`. Launcher ativo: backend na porta 3000, Preview na 3001, landing na 3005 e painel na 3343; as quatro verificações HTTP passaram. Processos anteriores e banco da aplicação foram preservados.

Correção `02c5b27`: `lib/auth.ts`, rota auth e regressões do handler real. Hooks nativos impedem log bruto de Error SMTP/adapter e saneiam respostas 5xx, inclusive APIError retornado diretamente; preservam status/cookies, origem, validação e redirecionamentos. Inicialização inválida responde 503 sem detalhes. Contrato atualizado; nenhuma dependência adicionada ou console global interceptado.

Validação final: lint sem warnings, typecheck, 60 unitários, 26 integrados e 2 E2E básicos passaram. Build Turbopack de produção passou em snapshot isolado com a correção; snapshot removido. Banco exclusivo de auditoria recebeu migrations duas vezes e seed duas vezes (1 negócio, 3 serviços, 6 horários e 5 migrations), depois foi removido. Onze provas HTTP de saúde/sessão, autorização/origem e entradas inválidas passaram. O EPERM histórico de build não reapareceu.

Plano detalhado: `docs/PLANO_BACKEND_HERMES.md`, com 12 atividades, donos, dependências, invariantes, testes e reversão. Codex Revisor: OK no commit 02c5b27, com 9 provas do handler. Cursor: MELHORAR, sem novo bloqueio no candidato; consumidores ainda precisam incorporar a correção. Recomenda um app Next final integrado, preservando Server Actions. Hermes recebe um único lote após concluir o anterior, sem interromper execução.

Pendências: integrar correção aos consumidores pelos donos; escolher composição final sem REST/serviços duplicados desnecessários; provisionamento real; gateway/recebedor/confirmação Pix; SMTP real; regras LGPD/assinatura e produção. Testes fake/Preview não provam Pix bancário. Sem merge/push/deploy; alterações documentais anteriores preservadas e fora desta entrega.
