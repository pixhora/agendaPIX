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
`pnpm test:e2e` contém apenas um teste do esqueleto em 375 px. Instale o Chromium do Playwright antes de executá-lo: `pnpm exec playwright install chromium`.
O terminal 3 adicionará os fluxos reais quando o agendamento e o Pix existirem.
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

O output standalone não inclui `drizzle-kit`, então a imagem traz `migrate.cjs`: `scripts/migrate.ts` empacotado com esbuild
(`pnpm build:migrate`), que usa o migrator do `drizzle-orm` e a mesma tabela de controle (`drizzle.__drizzle_migrations`) do `pnpm db:migrate`.
Rode **antes** de subir uma versão nova, como passo separado (não roda automaticamente no start do app):

```bash
docker run --rm --env-file .env.production agendapix node migrate.cjs
docker run -d --name agendapix --env-file .env.production -p 127.0.0.1:3000:3000 --restart unless-stopped agendapix
```

No Coolify, use `node migrate.cjs` como *pre-deployment command*. O script é idempotente e só aplica migrations pendentes.
Migrations devem continuar compatíveis com a versão anterior do app durante a troca (adicionar antes de remover).

### App completo com compose (imagem de produção local)

```bash
cp .env.example .env   # ajuste segredos; BETTER_AUTH_URL deve casar com APP_PORT
podman compose --profile app up -d --build   # ou: docker compose --profile app up -d --build
```

O profile `app` adiciona `migrate` (roda `node migrate.cjs` uma vez) e `app` (sobe depois que o migrate termina com sucesso),
ambos com a imagem do `Dockerfile`. Dentro do compose a `DATABASE_URL` aponta para o serviço `postgres`; a porta do app
fica em `127.0.0.1:${APP_PORT:-3000}`. Para SMTP local, `SMTP_HOST` precisa ser alcançável de dentro do container.

Em produção coloque um proxy com HTTPS (Caddy/Traefik do Coolify) na frente da porta 3000 e configure `BETTER_AUTH_URL` com o domínio público.
A imagem roda com `NODE_ENV=production`, então o provedor Pix simulado (`PAYMENT_PROVIDER=fake`) fica bloqueado e a cobrança responde 503 até existir um gateway real.

## CI

`.github/workflows/ci.yml` roda em pull requests para `master` e em push no `master`:

- `checks`: `pnpm install --frozen-lockfile` (cache do store do pnpm), `lint`, `typecheck`, `test`, `build`, `build:migrate`.
- `test-db`: Postgres 17 como service container, `pnpm db:migrate` e `pnpm test:db` (segredos de teste gerados na hora).
- `docker`: hadolint, build da imagem, `node migrate.cjs` pela imagem, app no ar e smoke test HTTP + `HEALTHCHECK`.
- `audit`: `pnpm audit --prod --audit-level=high`.

## Autenticação

Better Auth oferece email com link mágico em `/api/auth/[...all]`. Configure as variáveis SMTP antes de solicitar um link.
O cliente pode usar `authClient.signIn.magicLink({ email, callbackURL: "/" })` e `authClient.signOut()`.
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
`esbuild` (dev) empacota `scripts/migrate.ts` em `dist/migrate.cjs` para a imagem de produção; já vinha como dependência transitiva do `drizzle-kit`.
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

Dependência adicional: `qrcode` gera o QR Code PNG padronizado da simulação; evita implementar codificação de QR manualmente.
