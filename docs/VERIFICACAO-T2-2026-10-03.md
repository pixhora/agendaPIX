# Verificação do painel — T2 — 2026-10-03

## Identidade e limite da rodada

- Nome no Maestri: **CODEXADO**. Papel: **T2, painel do dono**.
- Pasta: `/var/home/matheus/projetos/agenda-dashboard`.
- Branch: `feat/dashboard`. Commit-base: `db341e6a57bf7fda7a9662666b391b4c1c0a2c4f`.
- Evidência refere-se ao commit-base **mais os arquivos locais preexistentes**, ainda não commitados, e às correções descritas abaixo.
- AGENTS.md, backlog, CONTRATOS.md, PROGRESSO.md e pedidos.md lidos. Árvore já estava suja; nenhum rebase, checkout, push, merge ou edição de outra worktree foi feito.
- Equipe considerada: T1 backend, T2 painel, T3 QA/revisão, T4 frontend. Nenhum agente criado.

## Parecer

**Bloqueia liberação de produção:** token de sessão aparece no log de falha de autenticação; responsabilidade T1. Integração administrativa precisa de alinhamento de contrato T1/T2 e revisão de T3. O painel verificado usa dados reais do PostgreSQL de teste, mas o produto ainda só tem provider Pix fake.

| Classificação | Arquivo:linha | Reprodução; esperado / observado | Encaminhamento |
| --- | --- | --- | --- |
| **bloqueia** | `lib/auth.ts:11` e `lib/auth.ts:16` | Com sessão válida, parar somente o PostgreSQL descartável e abrir `/dashboard/services`. Esperado: log sem credencial. Observado: Better Auth/Drizzle registra SQL de busca de sessão e `params` com token em texto. [Trecho sanitizado](evidencias/t2-2026-10-03/auth-log-redacted.txt). Nenhum token real foi usado. | **T1:** sanitizar logging de erros de autenticação/adapter e comprovar ausência do token; **T3:** revisão. Não corrigido por T2. |
| **bloqueia alinhamento administrativo** | `docs/CONTRATOS.md:71`, `lib/dashboard/data.ts:11`, `app/dashboard/(owner)/actions.ts:17` | Contrato prevê `/api/businesses/...`; painel existente usa consultas Drizzle no servidor e Server Actions. Esperado: contrato e ownership comuns. Observado: CRUD real funciona, mas as APIs administrativas previstas não existem nesta árvore. Não é mock nem prova de que a API prevista foi entregue. | **T1 + T2:** formalizar o caminho administrativo antes de integrar/liberar. Pedido preexistente mantido. |
| **ok após correção** | `lib/dashboard/session.ts:7` | Executar build sem variáveis de auth. Antes: `getAuth()` validava segredos durante prerender de `/dashboard` e falhava. Esperado: build sem segredos/banco. Agora: lê `headers()` antes de inicializar auth; `pnpm build` passa. | T2 corrigiu; T3 revisa. |
| **ok após correção** | `app/dashboard/(owner)/services/page.tsx:15`, `app/dashboard/(owner)/settings/page.tsx:10` | Alterar preço ou dias abertos e salvar. Antes: gravação persistia, mas `key` baseada em `updatedAt`/conteúdo remontava o formulário e apagava confirmação. Agora: identidade estável por serviço/negócio; mensagem de sucesso permanece, inclusive após revalidação; persistência confirmada após reload. | T2 corrigiu; T3 revisa. |
| **ok após correção** | `app/dashboard/(owner)/error.tsx:3` | Derrubar banco de teste, abrir painel, restaurar banco e clicar “Tentar novamente”. Antes: `reset()` mantinha erro, mesmo com banco saudável; nova navegação funcionava. Agora: `retry()` do Next 16.3.8 refaz leitura e recupera a tela. | T2 corrigiu; T3 revisa. |
| **melhorar** | `tests/e2e/skeleton.spec.ts:3` | Suíte versionada cobre esqueleto/auth, sem fluxo completo do painel. Esta rodada usou harness temporário com Playwright e fixtures isoladas. | **T3:** incorporar regressões do painel à suíte permanente com fixture/portas próprias. |
| **melhorar** | `app/globals.css:16` | Tema escuro do painel funciona; captura da agenda mostra ícone nativo do calendário escuro sobre fundo escuro. Não se declara auditoria AA integral. | **T4:** validar `color-scheme` dos controles nativos e contraste; T3 confirma acessibilidade. Sem redesign nesta rodada. |

## Ambiente e comandos

Linux `7.1.10-200.fc44.x86_64`; Node `22.23.3`; pnpm `12.8.1`; Next `16.3.8`; Vitest `4.1.11`; Playwright/Chromium instalado; PostgreSQL `17.11` em `postgres:17-alpine`.

Banco exclusivo `agenda_t2_test`, container `agenda-t2-verification`, bind `127.0.0.1:55442`; aplicação `127.0.0.1:3342`; capturador SMTP local `127.0.0.1:25242`. Dados: dono sintético, dois negócios (um vazio), serviço, cliente e reserva confirmada em 2030. Nenhum banco existente, cobrança bancária ou email externo utilizado. O SMTP local só guarda a mensagem de teste em `/tmp`.

| Comando | Resultado final | Evidência |
| --- | --- | --- |
| `pnpm lint` | exit 0; zero warnings | [log](evidencias/t2-2026-10-03/lint-final.log) |
| `pnpm typecheck` | exit 0; Next typegen + TypeScript | [log](evidencias/t2-2026-10-03/typecheck-final.log) |
| `pnpm test` | exit 0; **7 arquivos, 73 testes** | [log](evidencias/t2-2026-10-03/test-final.log) |
| `pnpm build` | exit 0; sem segredos ou conexão ao banco; rotas do painel dinâmicas | [log](evidencias/t2-2026-10-03/build-final.log) |
| `DATABASE_URL=<DB_TEST> node node_modules/drizzle-kit/bin.cjs migrate` | migrations aplicadas ao banco descartável | Execução inicial; nenhum schema de outro banco alterado. |
| `DATABASE_URL=<DB_TEST> BETTER_AUTH_URL=http://127.0.0.1:3342 BETTER_AUTH_SECRET=<SEGREDO_TESTE> node node_modules/vitest/vitest.mjs run --config vitest.db.config.ts tests/integration/dashboard.test.ts tests/integration/auth.test.ts` | exit 0; **2 arquivos, 4 testes** | [log](evidencias/t2-2026-10-03/db-final.log) |
| `node /tmp/agenda-t2-verification/browser.mjs` | exit 0; **39 checkpoints**, incluindo 20 combinações de tela/largura/tema | [log](evidencias/t2-2026-10-03/browser.log), [resultados](evidencias/t2-2026-10-03/browser-results.json) |
| `node /tmp/agenda-t2-verification/states.mjs` | exit 0 após correção; **4 checkpoints** de loading, pending, erro e recuperação com PostgreSQL real | [log](evidencias/t2-2026-10-03/states-fixed.log) |
| `node /tmp/agenda-t2-verification/login.mjs` | exit 0; **3 checkpoints** de formulário/SMTP local, sessão e rejeição de replay | [log](evidencias/t2-2026-10-03/login-final.log) |

Execução final do servidor: assets `.next/static` copiados para `.next/standalone/.next/static`; `HOSTNAME=127.0.0.1 PORT=3342 node .next/standalone/server.js` com as variáveis locais de banco/auth/SMTP. A matriz inicial usou o mesmo build via `next start`; loading/recuperação corrigidos e login foram repetidos com o servidor standalone.

Erros reais observados durante a rodada:

- Build no sandbox: Turbopack não pôde abrir porta interna (`Operation not permitted`). A execução direta fora do sandbox revelou o bug de prerender; após correção, o próprio `pnpm build` passou com o ambiente liberado.
- Uma tentativa redundante de build encontrou lock do build já em andamento; não foi atribuída ao produto.
- Primeira prova de recuperação falhou após 15 segundos com a tela de erro ainda visível. Corrigido `reset` → `retry` e repetida a mesma prova.
- O harness de login precisou ajustar a expectativa para o código real `INVALID_TOKEN` e selecionar o aviso dentro do formulário, excluindo o anunciador de rotas do Next. O aplicativo já exibia o aviso correto; não houve alteração de produto por isso.
- Ferramenta de browser não acionou alguns controles fora da área visível; prova foi refeita com foco/Enter e Playwright, verificando POST e persistência. Não foi classificada como falha de produto.

## Comportamentos comprovados

- Sessão ausente redireciona as quatro rotas protegidas ao login; logout invalida acesso. Resposta HTTP de navegação pode começar em `200` por streaming; o browser executa o redirecionamento do Next sem expor dados do dono.
- Login real no browser usa Better Auth, PostgreSQL e SMTP local; link recebido abre o negócio do dono sintético e não pode ser reutilizado. Sem SMTP configurado, mostra erro e não afirma envio.
- Agenda dia/semana mostra cliente, serviço, estado persistido e 09:00 no fuso `America/Sao_Paulo`. Clientes são consultados do banco.
- Serviço cadastrado pelo browser persistiu preço 2990/sinal 990. Edição persistiu preço 5299, mantendo sinal 1099; reserva anterior permaneceu em preço 5099/sinal 1099. Nenhum valor inválido foi inserido.
- Horários persistem após reload; intervalo invertido gera erro com foco. Negócio vazio tem estados próprios em agenda, clientes, serviços e funcionamento.
- Isolamento de leitura/escrita por dono testado com PostgreSQL e dois donos na suíte de integração; negócio inacessível não expõe dados no browser.
- Agenda dia/semana, clientes, serviços e funcionamento: **375 e 1280 px, claro e escuro**, sem overflow horizontal. Sem erros JavaScript na matriz normal. Entrada por teclado, link “Ir para o conteúdo”, edição com Enter e foco nos erros verificados. Não equivale a certificação WCAG completa.
- Loading real observado segurando lock de leitura no banco; botão “Salvando serviço…” desabilitado enquanto a gravação aguardava lock; erro e recuperação exercitados desligando/religando somente o container descartável.

Capturas: [agenda 375 escuro](evidencias/t2-2026-10-03/week-375-dark.png), [serviços desktop](evidencias/t2-2026-10-03/services-1280-light.png), [funcionamento 375](evidencias/t2-2026-10-03/settings-375-light.png), [loading](evidencias/t2-2026-10-03/loading-375.png), [erro de banco](evidencias/t2-2026-10-03/db-error-375.png), [link reutilizado](evidencias/t2-2026-10-03/login-expired-375.png).

## Pendências e próximo responsável

1. **T1:** remover token dos logs de falha e alinhar contrato/ownership administrativo. Não foi alterado backend/schema nesta rodada.
2. **T3:** revisão independente das quatro correções locais e incorporação dos fluxos à suíte E2E permanente. Os 46 checkpoints de browser são prova desta execução, não 46 testes versionados.
3. **T4:** contraste dos controles nativos no escuro. Rotas `/preview` e frontend público não foram avaliados por T2; ficam com T3/T4.
4. **Humano/T1:** gateway bancário, configuração SMTP externa e homologação de produção continuam pendentes. O provider existente é fake; nenhuma funcionalidade de cobrança real é declarada pronta.
5. Configurações observadas abrangem funcionamento; criação/edição de negócio e ações de status/pagamento permanecem dependências já registradas, sem novas funcionalidades nesta rodada.

## Comunicação e encerramento

A tentativa solicitada `maestri ask "Codex"` **não foi entregue**: `Multiple terminals named 'Codex' found (2)`. `maestri debug` confirmou conexão saudável; listagem conectada apresenta Codex e Codex #2, mas o resolvedor de nomes encontra duplicidade. Pendente de nome único do destinatário no canvas; relatório registrado em PROGRESSO/pedidos.

Servidor HTTP, capturador SMTP, browsers e PostgreSQL criados por T2 são encerrados ao final. O container descartável permanece parado para eventual reprodução; nenhum preview preexistente foi interrompido. Credenciais/cookies/email bruto de teste não foram copiados para as evidências versionáveis.
