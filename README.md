# Agenda

Esqueleto do produto de agendamento com sinal por Pix. Os fluxos comerciais ainda não estão implementados.

## Requisitos

- Node.js 22.16 ou superior e pnpm 12.8.1.
- Podman com um provedor Compose instalado. `podman compose version` deve funcionar; não é necessário ter o daemon Docker.
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

`test:db` exige banco iniciado e migrations aplicadas. Os testes usam transações revertidas ao final; não geram dados permanentes.
`pnpm test:e2e` contém apenas um teste do esqueleto em 375 px. Instale o Chromium do Playwright antes de executá-lo: `pnpm exec playwright install chromium`.
O terminal 3 adicionará os fluxos reais quando o agendamento e o Pix existirem.
`/api/health` verifica o processo HTTP, sem afirmar disponibilidade do banco ou do SMTP.

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
