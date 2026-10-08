# Agenda

Esqueleto do produto de agendamento com sinal por Pix. Os fluxos comerciais ainda não estão implementados.


## Requisitos

- Node.js 22.16 ou superior e pnpm 12.8.1.
- Podman com um provedor Compose (`podman compose version`) ou Docker com Compose v2. O mesmo `compose.yaml` serve aos dois.
- SMTP configurado para testar o envio de links de acesso. O build e os testes unitários não dependem de SMTP ou Postgres.

## Desenvolvimento

```bash
pnpm install
cp .env.example .env
# Substitua BETTER_AUTH_SECRET por um valor exclusivo, por exemplo: openssl rand -base64 32.
pnpm db:up
pnpm db:migrate
pnpm dev
```

Configure as credenciais de Postgres e a URL correspondente em `.env`. O banco escuta apenas em `127.0.0.1`.
`pnpm db:up` sobe só o serviço `postgres` (Postgres 17). Com Docker, use `docker compose up -d --wait postgres`.
Os dados ficam no volume nomeado `postgres_data`; `pnpm db:down` para o banco e preserva o volume.
Não há montagem de pastas do host. Qualquer futura montagem de pasta deve usar `:Z` neste ambiente com SELinux.
Nunca use `down -v` em um banco com dados que precisam ser preservados.

## Verificação

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:db
```

`test:db` exige banco iniciado e migrations aplicadas. Os testes de domínio usam transações revertidas ao final. O teste de autenticação remove seus próprios usuários, sessões e verificações ao terminar; o envio SMTP é simulado somente nesse teste.
`pnpm test:e2e` sobe `next dev` em `127.0.0.1:3344` e roda em 375 px: landing, login único, painel do dono (sessão, isolamento entre negócios), login por link mágico até `/dashboard` e cadastro concluído → "Ir para o painel". Precisa de banco migrado (`DATABASE_URL`) e das variáveis de auth; os links mágicos são capturados em arquivo via `MAGIC_LINK_CAPTURE_FILE` (somente testes), sem SMTP. Instale o Chromium do Playwright antes: `pnpm exec playwright install chromium`.
`/api/health` verifica o processo HTTP, sem afirmar disponibilidade do banco ou do SMTP.


## Docker e deploy

O produto é **um único app Next.js** (páginas + `/api`) em output `standalone`, mais Postgres. Não há serviços separados de backend/frontend.

### Imagem

`Dockerfile` multi-stage: Node 22 (`node:22-bookworm-slim`), pnpm via corepack na versão de `package.json#packageManager`,
`pnpm install --frozen-lockfile`, `next build` e runner só com `.next/standalone`, `.next/static`, `public`, o migrator e as migrations.
Roda como usuário não-root (uid 1000), escuta em `0.0.0.0:3000` e tem `HEALTHCHECK` em `/api/health`. Nenhum segredo entra na imagem.

```bash
docker build -t agendapix .
```

### Migrations no deploy

O output standalone não inclui scripts nem `drizzle-kit`, então a imagem traz `migrate.cjs`: `scripts/migrate.mjs` empacotado com esbuild
(`pnpm build:bundles`). É o mesmo migrador do `pnpm db:migrate`: aplica **cada arquivo na própria transação**, em ordem do journal
(o migrador do Drizzle junta todas numa transação só, o que quebra `0008` + `0009`: valor novo de ENUM só pode ser usado depois do COMMIT),
usa um advisory lock contra execuções simultâneas e grava na mesma tabela `drizzle.__drizzle_migrations` (hash + `when`), então é no-op
num banco já migrado pelo `drizzle-kit migrate`.
Rode **antes** de subir uma versão nova, como passo separado (não roda automaticamente no start do app):

```bash
docker run --rm --env-file .env.production agendapix node migrate.cjs
docker run -d --name agendapix --env-file .env.production -p 127.0.0.1:3000:3000 --restart unless-stopped agendapix
```

No Coolify, use `node migrate.cjs` como *pre-deployment command*. O script é idempotente e só aplica migrations pendentes.
Para o worker de reconciliação, a mesma imagem roda `node reconcile.mjs` (loop) ou `node reconcile.mjs --once` (uma passagem).
Migrations devem continuar compatíveis com a versão anterior do app durante a troca (adicionar antes de remover).

### App completo com compose (imagem de produção local)

```bash
cp .env.example .env   # ajuste segredos; BETTER_AUTH_URL deve casar com APP_PORT
podman compose --profile app up -d --build   # ou: docker compose --profile app up -d --build
```

O profile `app` adiciona `migrate` (roda `node migrate.cjs` uma vez), `app` e `worker` (sobem depois que o migrate termina com sucesso),
todos com a imagem do `Dockerfile`. Dentro do compose a `DATABASE_URL` aponta para o serviço `postgres`; a porta do app
fica em `127.0.0.1:${APP_PORT:-3000}`. Para SMTP local, `SMTP_HOST` precisa ser alcançável de dentro do container.

Em produção coloque um proxy com HTTPS (Caddy/Traefik do Coolify) na frente da porta 3000 e configure `BETTER_AUTH_URL` com o domínio público.
A imagem roda com `NODE_ENV=production`, então o provedor Pix simulado (`PAYMENT_PROVIDER=fake`) fica bloqueado e a cobrança responde 503 até existir um gateway real.

### Proxy e antiabuso das reservas (produção)

Com o backend endurecido (PRs #4 e #5) o rate limit e os limites de reservas pendentes usam o IP do cliente informado pelo proxy:

- Rode o app **sempre atrás do proxy**, sem acesso direto à porta 3000 (o compose só publica em `127.0.0.1`), e configure `BOOKING_TRUST_PROXY=true`.
- O proxy precisa **sobrescrever** `X-Real-IP` com o endereço real do cliente (nunca repassar o valor recebido). Ex.: Nginx `proxy_set_header X-Real-IP $remote_addr;`,
  Caddy `header_up X-Real-IP {remote_host}` dentro do bloco `reverse_proxy`. No Traefik/Coolify, confirme que o header chega reescrito antes de ativar.
  Se só houver `X-Forwarded-For`, use `BOOKING_CLIENT_IP_HEADER=x-forwarded-for` e `BOOKING_TRUSTED_PROXY_HOPS` = número de proxies confiáveis.
- `BOOKING_RATE_LIMIT_*`, `BOOKING_HOLD_MINUTES` e `BOOKING_MAX_PENDING_*` são opcionais (padrões em `.env.example`). Valor inválido deixa o agendamento em `503`
  de propósito: depois de mudar variáveis, confira uma reserva de teste.

### Ordem de deploy das migrations

Cada versão roda `node migrate.cjs` **antes** do novo código subir (pre-deployment command). Com o backend atual (PRs #5 e #7):

1. `0007_backend_hardening` vai junto com o código do #5;
2. `0008_pix_charge_outside_tx` (só `ALTER TYPE ... ADD VALUE`) e `0009_pix_charge_schema` (usa os valores novos) vão junto com o código do #7.

O migrador por arquivo aplica 0007 → 0008 → 0009 em ordem, cada uma com o próprio COMMIT, inclusive quando todas estão pendentes no mesmo deploy.
**Não use `drizzle-kit migrate`** (nem o migrador do `drizzle-orm`) para essas migrations: ele roda tudo numa transação e a 0009 falha.
Não publique o código do #5/#7 sem as migrations correspondentes aplicadas.

### Worker de reconciliação

O reconciliador (`scripts/reconcile.ts`, PR #7) recupera cobranças órfãs (presas em `creating`), reservas vencidas e webhooks perdidos.
**Ele precisa estar rodando antes de contar com a recuperação de cobranças órfãs.** Escolhemos um processo contínuo:

- compose: serviço `worker` (perfil `app`, mesma imagem, sem porta publicada) com `node reconcile.mjs`, uma passagem a cada `RECONCILE_INTERVAL_SECONDS` (padrão 60);
- Coolify/produção: um segundo serviço com a mesma imagem e comando `node reconcile.mjs`, sem domínio/porta.

Alternativa: cron/systemd timer/*Scheduled Task* do Coolify rodando `node reconcile.mjs --once` a cada minuto (sem o serviço `worker`).
Mais de uma instância é segura (advisory lock: uma trabalha, as outras pulam a passagem). Variáveis: `PAYMENT_PROVIDER_TIMEOUT_MS`,
`RECONCILE_INTERVAL_SECONDS`, `RECONCILE_STUCK_SECONDS`, `RECONCILE_BATCH_SIZE` (padrões em `.env.example`).
Na imagem (`NODE_ENV=production`) o provedor Pix fake é recusado, então cada passagem registra falha até existir um gateway real.

## CI

`.github/workflows/ci.yml` roda em todo pull request (a partir do momento em que o workflow existe na branch base), em push no `master` e manualmente (`workflow_dispatch`):

- `checks`: `pnpm install --frozen-lockfile` (cache do store do pnpm), `lint`, `typecheck`, `test`, `build`, `build:bundles`.
- `test-db`: Postgres 17 como service container, `pnpm db:migrate` (duas vezes: a segunda deve ser no-op) e `pnpm test:db` (segredos de teste gerados na hora).
- `docker`: hadolint, build da imagem, `node migrate.cjs` pela imagem, app no ar e smoke test HTTP (`/`, `/api/health`, rota pública com banco,
  `/api/ready` com um SMTP descartável quando a rota existir, usuário não-root), reconciliador (`--once` contra o banco e worker em loop,
  quando `reconcile.mjs` existir) + `HEALTHCHECK`.
- `e2e`: Postgres 17 vazio, Chromium do Playwright, `pnpm db:migrate` e `pnpm test:e2e` (só quando `tests/e2e/global-setup.ts` e `docs/E2E.md` existem — a suíte completa chega com o PR #8; sem ela o job passa sem rodar nada). Em falha sobe `playwright-report/` e `test-results/`.
- `audit`: `pnpm audit --prod --audit-level=high`.

## Frontend

O produto é um único app Next: as telas, o painel do dono e as rotas de API rodam no mesmo processo e na mesma origem. Não há backend separado nem proxy, nem painel em outra porta.

| Rota | O que é | Dados |
| --- | --- | --- |
| `/` | Landing | Estática |
| `/[slug]` | Página pública de agendamento com sinal por Pix | `GET/POST /api/public/[slug]/*` (same-origin) |
| `/onboarding` | Cadastro do negócio em 4 passos; termina com link mágico | `POST /api/auth/sign-in/magic-link` |
| `/onboarding/concluir` | Destino do link mágico do cadastro; provisiona o negócio | `POST /api/onboarding` (sessão por cookie, `Idempotency-Key`) |
| `/login` | Login único do dono por link mágico (volta para `/dashboard` ou para `?next=` relativo); `/dashboard/login` redireciona para cá | `POST /api/auth/sign-in/magic-link` |
| `/dashboard` | Painel do dono: agenda do dia/semana, `/dashboard/services`, `/dashboard/customers`, `/dashboard/settings` (funcionamento e chave Pix) | Server Components + Server Actions com sessão Better Auth no mesmo processo; cada consulta filtra pelo negócio do dono |
| `/preview/*` | Demonstração com dados falsos (`lib/preview/mock-data.ts`) | Nenhuma chamada ao banco |

As URLs das rotas públicas são montadas em `lib/public-api.ts`, que codifica slug, ids e parâmetros de busca com `encodeURIComponent`/`URLSearchParams`.
Tokens visuais e a Placa de Valor estão descritos em [docs/design-tokens.md](docs/design-tokens.md).

## Autenticação

Better Auth oferece email com link mágico em `/api/auth/[...all]`. Configure as variáveis SMTP antes de solicitar um link.
As telas usam `requestMagicLink` (`lib/magic-link.ts`), que envia `callbackURL` e `errorCallbackURL` relativos: link expirado ou já usado volta para `/login?error=…` com aviso. Destinos pós-login passam por `safeNextPath` (`lib/safe-redirect.ts`), que só aceita caminhos do próprio app.
O link expira em cinco minutos, é consumido uma vez e fica armazenado como hash.
Não há login por senha ou Google nesta etapa. Nenhum link ou token é registrado no terminal.

## Banco e migrations

O schema fica em `db/schema`. `pnpm db:generate` gera migrations versionadas; revise o SQL antes de commitar.
`pnpm db:migrate` aplica apenas migrations pendentes e registra o progresso no banco.
O contrato, as regras de isolamento e o caminho de reversão estão em [docs/CONTRATOS.md](docs/CONTRATOS.md).

## Dependências

Next.js, React, TypeScript, Tailwind, Radix, Drizzle, Better Auth, Zod, Vitest e Playwright implementam a stack solicitada.
`pg` fornece o driver Postgres; `dotenv` carrega `.env` nas ferramentas de banco.
`@better-auth/drizzle-adapter` conecta a versão atual do Better Auth ao Drizzle.
`nodemailer` envia o link mágico por SMTP próprio, sem depender de um serviço pago.
`clsx`, `tailwind-merge` e `class-variance-authority` compõem as classes e variantes do botão shadcn/ui.
ESLint 9.39.5 está fixado porque o plugin React do Next.js ainda usa APIs removidas no ESLint 10.
Os scripts de instalação permitidos estão limitados a `esbuild` e `unrs-resolver`, necessários às ferramentas nativas.
`esbuild` (dev) empacota `scripts/migrate.mjs` em `dist/migrate.cjs` e `scripts/reconcile.ts` em `dist/reconcile.mjs` para a imagem de produção (`scripts/bundle.mjs`); já vinha como dependência transitiva do `drizzle-kit`.
`pnpm-workspace.yaml` força `esbuild@^0.25` para `@esbuild-kit/core-utils` (usado pelo `drizzle-kit`), que fixava a 0.18 vulnerável (GHSA-67mh-4wv8-2f99).


## Fluxo Pix simulado

As rotas públicas agora oferecem serviços, disponibilidade, reserva e consulta do pagamento.
Veja os formatos, headers e exemplos em [docs/CONTRATOS.md](docs/CONTRATOS.md).
Atualize `.env` com `PAYMENT_PROVIDER=fake` e um `FAKE_WEBHOOK_SECRET` exclusivo de pelo menos 32 caracteres.
A simulação funciona em desenvolvimento/testes; fica bloqueada em produção. QR Code e copia-e-cola são fictícios e não pagam em banco.

Após atualizar a branch, execute `pnpm install` e `pnpm db:migrate` antes de iniciar `pnpm dev`.
A migration de concorrência exige a extensão Postgres `btree_gist`; a imagem local de Postgres já a disponibiliza.
Não exclua reservas antigas para resolver erro de sobreposição: revise os registros antes de tentar a migration novamente.

`pnpm test` verifica centavos, assinaturas HMAC, estados de pagamento e geração de horários.
`pnpm test:db` verifica disputa de horário, repetição de cobrança, auditoria, rollback, isolamento e pagamento tardio com Postgres real.
Os testes Pix removem somente as entidades de teste criadas por eles. Não há gateway real nesta etapa.


## Cobrança Pix fora da transação e reconciliação

A reserva segura o horário numa transação curta (status `creating` no pagamento) e só então chama o gateway, com timeout (`PAYMENT_PROVIDER_TIMEOUT_MS`, padrão 8s). Assim o lock do negócio não fica preso à latência do provedor. Se a chamada falhar, a resposta é `503` retriável; o replay com a mesma `Idempotency-Key` retoma a cobrança sem criar segunda reserva.

O reconciliador cobre cobranças órfãs e webhooks perdidos:

```bash
pnpm reconcile --once          # uma passagem (cron/systemd)
pnpm reconcile                 # loop contínuo
pnpm reconcile --once --json   # report estruturado
```

Variáveis: `RECONCILE_INTERVAL_SECONDS`, `RECONCILE_STUCK_SECONDS`, `RECONCILE_BATCH_SIZE`. Em produção use `--once` a cada minuto atrás de um scheduler; vários processos são seguros (advisory lock de sessão). Política de pagamento tardio por negócio: `businesses.late_payment_policy` = `refund` (padrão) ou `rebook_if_free`.

Migrations `0008` (enum) e `0009` (schema) exigem o migrador em `scripts/migrate.mjs` (`pnpm db:migrate`), que aplica cada arquivo na própria transação — necessário porque o Postgres só libera valores novos de ENUM após o COMMIT.

## Antiabuso das reservas públicas

Variáveis opcionais (padrões em `.env.example`); valor inválido deixa o agendamento indisponível (`503`) em vez de cair em padrão silencioso.

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `BOOKING_TRUST_PROXY` | `false` | Confia no header de IP do proxy de entrada. Só ative se o Next não for acessível diretamente. |
| `BOOKING_CLIENT_IP_HEADER` | `x-real-ip` | `x-real-ip` ou `x-forwarded-for`. |
| `BOOKING_TRUSTED_PROXY_HOPS` | `1` | Com `x-forwarded-for`: número de proxies confiáveis; o IP do cliente é o N-ésimo item a partir da direita. |
| `BOOKING_RATE_LIMIT_PER_CLIENT` | `10` | Tentativas por minuto por cliente e negócio. |
| `BOOKING_RATE_LIMIT_PER_BUSINESS` | `120` | Teto de tentativas por minuto por negócio, somando todos os clientes. |
| `BOOKING_HOLD_MINUTES` | `30` | Tempo de reserva aguardando o Pix (28–43200). O Mercado Pago recebe esse prazo mais 2 minutos, no mínimo 30. |
| `BOOKING_MAX_PENDING_PER_CLIENT` | `3` | Reservas pendentes simultâneas por cliente (IP) e negócio. |
| `BOOKING_MAX_PENDING_PER_PHONE` | `2` | Reservas pendentes simultâneas por telefone e negócio. |
| `BOOKING_MAX_PENDING_PER_BUSINESS` | `50` | Reservas pendentes simultâneas por negócio. |

Exemplos de proxy: Nginx com `proxy_set_header X-Real-IP $remote_addr;` usa o padrão. Um balanceador que anexa `X-Forwarded-For` usa `BOOKING_CLIENT_IP_HEADER=x-forwarded-for` e `BOOKING_TRUSTED_PROXY_HOPS=1`; CDN + balanceador, `2`.
Sem proxy confiável, o servidor usa o endereço do socket que o Next põe em `X-Forwarded-For`. Um cliente pode forjar esse header para escapar do próprio limite, mas não consegue esgotar o limite de outros clientes; o teto por negócio limita o total. Em produção, configure o proxy.
Endereços nunca são armazenados: só HMAC por negócio. IPv6 é agrupado por /64.

Dependência adicional: `qrcode` gera o QR Code PNG padronizado da simulação; evita implementar codificação de QR manualmente.
