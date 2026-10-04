# B-05 — Disponibilidade e prova integrada

Status: **COMPLETO no critério operacional B-05**, sobre `feat/dashboard` base `f4b43615d45ef634fdf219280b0c7d02538606a3`. Sem mudança de código de produto, autenticação, schema ou políticas de segurança. B-03/F-02/F-06 não iniciadas.

## Ambiente próprio

Infraestrutura antiga de `/tmp/agenda-t2-final` não existe mais; portas3343/55442/25242 estavam sem listener. Não reutilizamos dados nem interrompemos processos existentes.

- App: http://127.0.0.1:3343, PID inicial96096, worktree agenda-dashboard.
- PostgreSQL17: container próprio `agenda-t2-b05-d0bbcdb1`, porta127.0.0.1:55443, banco exclusivamente sintético `agenda_t2_b05`; imagem já instalada, sem downloads/dependências.
- SMTP local:127.0.0.1:25243, PID96095; entrega MIME em arquivos privados. Não envia email externo.
- Manifesto privado: `/tmp/agenda-t2-b05-UyyG6a/runtime.json`. Env/fixture/mails/logs privados nesse diretório0700, arquivos sensíveis0600; não versionados nem publicados.
- Origem Better Auth definida **exatamente** como `http://127.0.0.1:3343`; trustedOrigins segue código existente. Segredo aleatório só deste ambiente. Nenhuma sessão foi inserida manualmente e nenhum bypass foi criado.
- Migrations existentes aplicadas apenas ao banco novo. Fixtures: um dono/negócio/serviço/cliente/horário/reserva sintéticos. Reserva confirmada é seed de leitura, não prova de pagamento.

## Comandos e resultados desta execução

1. `podman run -d --name agenda-t2-b05-d0bbcdb1 --env-file <arquivo privado> -p 127.0.0.1:55443:5432 docker.io/library/postgres:17-alpine`: passou. `podman exec agenda-t2-b05-d0bbcdb1 pg_isready -U t2_test -d agenda_t2_b05`: accepting connections.
2. `pnpm db:migrate`, com env privado injetado no processo: migrations applied successfully.
3. App próprio: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3343`, env de teste próprio. SMTP nativo local com captura privada; ambos continuam ativos.
4. `curl -sS -o /dev/null -w 'login %{http_code} %{time_total}\n' --max-time 15 http://127.0.0.1:3343/dashboard/login`: HTTP200,0,509s. Health200,0,089s. Confirmação final login200.
5. `QA_DASHBOARD_URL=http://127.0.0.1:3343 QA_DASHBOARD_FIXTURES=/tmp/agenda-t2-b05-UyyG6a node /var/home/matheus/projetos/agenda-tests/node_modules/@playwright/test/cli.js test --config /var/home/matheus/projetos/agenda-tests/tests/qa/dashboard.config.ts --output /var/home/matheus/projetos/agenda-dashboard/test-results/dashboard-b05`: **1/1 passou,10,9s**. Suíte QA existente lida/executada sem editar worktree alheia; todos os resultados gravados na própria worktree.
6. `QA_DASHBOARD_URL=http://127.0.0.1:3343 QA_DASHBOARD_FIXTURES=/tmp/agenda-t2-b05-UyyG6a node tests/dashboard-ui/b05-browser.mjs`: **8/8 telas**, quatro rotas375/1280px. Sem overflow. Cliente/serviço/status exibidos da fixture PostgreSQL; funcionamento09:00 reaparece na tela; WhatsApp real44px/URL/mensagem/teclado. Serviço desativado, recarregado e reativado por Server Action, flags verificadas no banco. Contagem final da fixture: reserva1/serviço1/cliente1/horário1.
7. `pnpm lint`: passou. `git diff --check`: passou. Sem build/typecheck/unitários gerais novos, pois não houve mudança de produto; checks gerais de f4b4361 são históricos.

Erro real de preparação: primeira execução usou CLI Playwright da worktree T2 contra suíte que importa instalação T3, resultando `Playwright Test did not expect test() to be called here` e nenhum teste. Execução com CLI da própria instalação T3 resolveu sem instalar/alterar dependências. Não foi falha de produto.

## O que a prova demonstra

Login de formulário enviou link ao SMTP local; verificação do link criou sessão normal Better Auth; reutilização foi rejeitada. QA verificou leitura da semana, criação/edição/reload de serviço, valores8035/2015 centavos e preço atualizado8590, validação sinal maior que preço, tentativa de businessId alheio rejeitada, horários persistidos no banco e relidos, além de redirecionamento sem sessão. Não se alegou exclusão por UI: contrato só oferece criação/edição/inativação de serviços e substituição de horários; remoção dos registros temporários da suíte foi limpeza SQL de teste.

As capturas desta pasta são das rotas autenticadas reais em3343; não utilizam HTTP mock, sessão artificial, Shell simulado ou dados de produção. Token/cookie/MIME não entram em traces, vídeos ou screenshots do login; relatório não exporta logs privados.

## Limites e reversão

API Pix continua ausente desta branch, e aparece erro de carga em configurações; B-05 não incluiu nem aprovou essa integração. Boundary de logs de auth continua pendência de T1, não revalidado sob falha SMTP nesta tarefa. Isso não bloqueou o caminho feliz sintético, mas impede afirmar prontidão de produção.

Para reversão operacional, confirmar PIDs/comandos atuais pelo manifesto e `/proc` antes de sinalizar os grupos próprios96096(app)/96095(SMTP), e parar somente `agenda-t2-b05-d0bbcdb1`. Não remover dados nem parar containers/portas de outros agentes. Fixtures e logs privados ficam preservados. Não há alteração de segurança para reverter; documentação/prova pode ser revertida pelo commit B-05.

Próxima ação: entregar este caminho ao Codex/fila; T1 resolve pendências de auth/Pix e QA revalida integração correspondente quando autorizada. Nenhuma nova mensagem ao Hermes.
