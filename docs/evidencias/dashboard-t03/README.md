# T-03 — WhatsApp nos clientes

Base: feat/dashboard, daf70ee. Alteração de produto restrita a `app/dashboard/(owner)/customers/page.tsx`: ação WhatsApp junto de Ligar, com mensagem neutra contendo nome do cliente e negócio. Telefones E.164 viram apenas dígitos; não adicionar prefixo55 novamente. Texto usa encodeURIComponent; nova aba tem noopener/noreferrer. Consultas, autorização e dados preservados.

## Verificação executada

- `pnpm lint`: passou, zero warnings.
- `pnpm typecheck`: passou.
- `pnpm test`:73/73, sete arquivos,1,24s, após alteração de produto.
- `QA_CUSTOMERS_HTML=/tmp/t2-customers-t03.html pnpm exec vitest run --config tests/dashboard-ui.config.ts`:1/1,277ms. Renderiza CustomersPage real com sessão/dados/Shell controlados e valida URL E.164, mensagem codificada, vínculo de negócio enviado ao leitor e ligação preservada. Não testa isolamento no banco.
- Chromium com HTML acima e CSS real de app/globals.css compilado por PostCSS/Tailwind instalados:375/1280px, WhatsApp44px, sem overflow, foco WhatsApp e Tab para Ligar. Capturas e results.json nesta pasta. Não houve navegação externa para WhatsApp.
- `git diff --check`: passou.

Prova de browser é isolada do backend; sessão, dados e Shell foram controlados em teste. Não é screenshot da rota autenticada em3343. Servidor3343 estava recusando conexão, assim como a infraestrutura sintética original estava sem portas ativas; nenhum processo foi iniciado/parado ou dado real acessado nesta tarefa. QA integrado fica pendente quando ambiente de teste voltar. Sem build novo: mudança pequena de link e layout; lint/typecheck/test e browser focado executados.

Reversão do produto: revert da alteração de customers/page.tsx, ou revert do commit de T-03. Sem alteração de tokens/componentes compartilhados/backend.

## Relay T-01

Mensagem de Hermes destinada a T1: corrigir Error/stack em lib/auth.ts:16 e app/api/auth/[...all]/route.ts:10, causa better-call/router.mjs:93; base0d6858f considerada vulnerável pelo solicitante; regressão exige handler real, não apenas callback; reversão por revert do commit.

Tentativa única `maestri ask Codex` foi rejeitada: `Multiple terminals named 'Codex' found (2). Rename them to have unique names.` Debug confirmou transporte200. Não foi possível entregar a T1 por nome inequívoco. Nenhum terminal foi renomeado/criado/interrompido; nenhum novo envio ao Hermes. Coordenador/humano deve repassar T-01 ao dono/backend identificado.
