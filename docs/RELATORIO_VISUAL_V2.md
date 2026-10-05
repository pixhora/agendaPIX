# Relatório T2 — painel visual v2

Status: **PARCIAL**. Entrega de código `97db50baf29ca3de55fb05b45f1b50f5ddb62bba`. Código e gates passaram. Capturas autenticadas do painel ficaram pendentes: não há fixture/sessão QA disponível nesta execução (`QA_DASHBOARD_*` ausentes; arquivos de fixture locais esperados ausentes). Não solicitei login SMTP nem usei dados reais.

## Mudanças

- Aplicados tokens v2 e registrada a exceção aprovada em `docs/design-tokens.md`.
- Shell, agenda, serviços, clientes, configurações e login usam superfícies paper/surface, texto ink/muted, divisores line, raios e foco dos tokens. Ações primárias usam pílula ink; lima fica em indicadores pequenos.
- Agenda mostra placa dos sinais confirmados no dia e a próxima reserva elegível. Soma usa centavos retornados pelo servidor; helper tem cobertura de timezone, status e formatação inteira.
- Feedback de formulário, Pix, login, erro e carregamento usa tokens sem transformar `--muted` em fundo expansivo.

## Provas executadas

- `pnpm lint` — passou, zero avisos.
- `pnpm typecheck` — passou.
- `pnpm test` — 9 arquivos, 82/82 testes.
- `pnpm exec playwright test -c tests/e2e/dashboard-login.config.ts` — 8/8; rota real `http://127.0.0.1:3343/dashboard/login`, viewports 375/390/1280, temas claro/escuro; foco visível e zero erros de console/página.
- `pnpm build` — Next.js 16.3.8, build de produção concluído.
- `curl http://127.0.0.1:3343/dashboard/login` — HTTP 200.
- `git diff --check` — passou.

Capturas atuais do login: [375 claro](evidencias/dashboard-v2/login-375-light.png), [375 escuro](evidencias/dashboard-v2/login-375-dark.png), [1280 claro](evidencias/dashboard-v2/login-1280-light.png), [1280 escuro](evidencias/dashboard-v2/login-1280-dark.png).

## Pendente

Capturar agenda, serviços, clientes e configurações autenticados em 375/1280 claro/escuro quando T2 receber sessão e dados de QA sintéticos válidos. Até lá, a revisão visual integrada dessas rotas não está comprovada. Nenhuma sessão, segredo ou processo alheio foi alterado.

## Plano de continuação — 2026-10-04

1. Reutilizar somente o negócio sintético B02 já existente na base local, sem migrations ou seed.
2. Emitir uma sessão temporária de fixture para esse dono e validá-la na autoridade real; isso não prova entrega SMTP.
3. Executar o build atual do painel em processo isolado, com a mesma conexão da autoridade, preservando o preview 3343.
4. Capturar rotas autenticadas e verificar console, teclado, overflow e movimento reduzido; encerrar somente os recursos de teste criados nesta rodada.
