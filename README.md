# Agenda

Esqueleto do produto de agendamento com sinal por Pix. Os fluxos comerciais ainda não estão implementados.


## Painel do dono (app único)

A branch `feat/dashboard-v2` incorpora o painel do dono no mesmo app Next do backend (`feat/backend` como base). Não use o modelo antigo de painel em porta `3343` falando HTTP com autoridade separada. Sessão: Better Auth no mesmo processo. O PR #1 (`feat/dashboard`) permanece histórico e não deve ser atualizado por esta linha de trabalho.

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

`test:db` exige banco iniciado e migrations aplicadas. Os testes de domínio usam transações revertidas ao final. O teste de autenticação remove seus próprios usuários, sessões e verificações ao terminar; o envio SMTP é simulado somente nesse teste.
`pnpm test:e2e` contém apenas um teste do esqueleto em 375 px. Instale o Chromium do Playwright antes de executá-lo: `pnpm exec playwright install chromium`.
O terminal 3 adicionará os fluxos reais quando o agendamento e o Pix existirem.
`/api/health` verifica o processo HTTP, sem afirmar disponibilidade do banco ou do SMTP.

## Frontend

O produto é um único app Next: as telas e as rotas de API rodam no mesmo processo e na mesma origem. Não há backend separado nem proxy.

| Rota | O que é | Dados |
| --- | --- | --- |
| `/` | Landing | Estática |
| `/[slug]` | Página pública de agendamento com sinal por Pix | `GET/POST /api/public/[slug]/*` (same-origin) |
| `/onboarding` | Cadastro do negócio em 4 passos; termina com link mágico | `POST /api/auth/sign-in/magic-link` |
| `/onboarding/concluir` | Destino do link mágico do cadastro; provisiona o negócio | `POST /api/onboarding` (sessão por cookie, `Idempotency-Key`) |
| `/login` | Entrada do dono por link mágico (volta para `/dashboard`) | `POST /api/auth/sign-in/magic-link` |
| `/preview/*` | Demonstração com dados falsos (`lib/preview/mock-data.ts`) | Nenhuma chamada ao banco |

As URLs das rotas públicas são montadas em `lib/public-api.ts`, que codifica slug, ids e parâmetros de busca com `encodeURIComponent`/`URLSearchParams`.
Tokens visuais e a Placa de Valor estão descritos em [docs/design-tokens.md](docs/design-tokens.md).

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
