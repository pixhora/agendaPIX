# Auditoria de autenticação — plano, sem implementação

Data: 2026-10-03. Escopo: código em `agenda-backend` e divergência de login em `agenda-dashboard` / `agenda-conversion`. Nenhum `.env` foi aberto. Nenhum segredo, token ou email de usuário foi impresso. SMTP não foi classificado como vulnerabilidade.

## RESULTADO — MELHORAR

O envio que falha em `http://localhost:3343/dashboard/login` não prova falha de SMTP. O código recusa a origem antes de chamar o envio quando ela difere da origem de `BETTER_AUTH_URL`. Isso bloqueia o login operacional. Não é, por si, uma falha de segurança. Não relaxar a checagem.

## ANÁLISE

`lib/auth.ts:14-17` fixa `baseURL` e `trustedOrigins` na origem única de `BETTER_AUTH_URL`. O plugin usa `formCsrfMiddleware`. Origem ausente ou não confiável responde `403` `INVALID_ORIGIN` (`node_modules/better-auth/dist/api/middlewares/origin-check.mjs:111-116`). O logger do app descarta o detalhe (`lib/auth-logger.ts:2-4`).

O dashboard chama `authClient.signIn.magicLink` com `callbackURL: "/dashboard"` e `errorCallbackURL: "/dashboard/login?error=link"` (`agenda-dashboard/components/dashboard/login-form.tsx:35`). A conversão faz `fetch` próprio, omite `errorCallbackURL` e, em development, trata HTTP 500 ou erro de rede como sucesso simulado (`agenda-conversion/app/login/page.tsx:12-31` e `48-50`). Essa simulação não roda na porta 3343.

Token fica hasheado (`lib/auth.ts:19`). Prazo padrão da biblioteca é 300 segundos (`magic-link/index.mjs:98`), igual ao texto do email (`lib/email.ts:17`). O consumo é único (`magic-link/index.mjs:173-174`). O teste integrado cobre criação de sessão, ausência do token no banco e rejeição do segundo uso (`tests/integration/auth.test.ts:20-50`). Não cobre expiração, origem inválida nem callback externo.

Cookie de sessão: `httpOnly`, `sameSite: "lax"`, `secure` só com prefixo seguro (`cookies/index.mjs:33-37`). Rate limit do magic link é 5 por 60 segundos, mas o limitador global só liga por padrão em produção (`create-context.mjs:170-174`; `magic-link/index.mjs:216-221`). `lib/auth.ts` não liga o limite fora de produção.

Callback absoluto fora da origem confiável é recusado (`origin-check.mjs:55-62`). Callback relativo é permitido. Não há teste nosso desse caso.

Cadastro por link é aberto: `disableSignUp` não está definido (`magic-link/index.mjs:180`). A resposta de pedido bem-sucedido é sempre `{ status: true }` (`magic-link/index.mjs:114`), sem dizer se o email já existe.

Pix e webhook não participam deste login. Confirmação de reserva continua só com evento autenticado. Provider fake recusa produção (`lib/payments/index.ts:7-8`). Webhook entra por `app/api/webhooks/payments/[provider]/route.ts:4-5`.

## PROBLEMAS

1. MELHORAR — login 3343 pode morrer na origem, não no SMTP. Prova: `lib/auth.ts:17` e `origin-check.mjs:116`. T2 registrou `BETTER_AUTH_URL` na porta 3342 contra servidor 3343. Esta auditoria não leu `.env`. Dono: T1. Impacto: nenhum email parte se a origem já foi recusada.

2. MELHORAR — `agenda-conversion/app/login/page.tsx:29-30` mente sucesso quando o envio falha em development. Dono: T5. Não copiar para o dashboard.

3. MELHORAR — rate limit desligado fora de produção e sem teste. Dono: T1. T3 cobre o teste.

4. MELHORAR — duas UIs de login. Canônico de autenticação: rota `/dashboard/login` do dashboard. Links `Entrar` da landing apontam `/login` (`LandingHeader.tsx:43`, `LandingFooter.tsx:20`). Mudar só no merge. Dono do href: T5. Dono da auth: T2 permanece no `authClient`.

## IMPACTO

- T1: separar `403 INVALID_ORIGIN` de erro SMTP, alinhar origem do `BETTER_AUTH_URL` ao browser, sem desligar a checagem. Testar expiração, callback externo e limite.
- T2: manter `authClient` e os dois callbacks. Não simular envio.
- T3: acrescentar os testes abaixo. Não tratar falha de SMTP como vulnerabilidade.
- T5: remover sucesso simulado antes de qualquer uso real dessa página. Href `/dashboard/login` só no merge.
- T4 e T6: sem mudança nesta correção.

## SEQUÊNCIA

1. T1 observa o status HTTP do `POST /api/auth/sign-in/magic-link` no browser da porta 3343, sem copiar corpo, cookie ou email.
2. Se for `403`, corrigir a origem configurada. Se for `5xx` depois de origem aceita, aí investigar SMTP.
3. T3 prova origem rejeitada, callback externo rejeitado, token expirado e segundo uso.
4. T5 elimina a simulação na própria worktree.
5. Merge futuro aponta `Entrar` para `/dashboard/login`.

## VALIDAÇÃO

Nenhum teste executado nesta auditoria. Leitura de `lib/auth.ts`, `lib/email.ts`, `lib/env.ts`, `lib/auth-logger.ts`, `tests/integration/auth.test.ts`, login das duas worktrees e trechos citados do Better Auth instalado.
