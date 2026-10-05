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

`test:db` exige banco iniciado e migrations aplicadas. Os testes de domínio usam transações revertidas ao final. O teste de autenticação remove seus próprios usuários, sessões e verificações ao terminar; o envio SMTP é simulado somente nesse teste.
`pnpm test:e2e` sobe `next dev` em `127.0.0.1:3344` e roda em 375 px: landing, login único, painel do dono (sessão, isolamento entre negócios), login por link mágico até `/dashboard` e cadastro concluído → "Ir para o painel". Precisa de banco migrado (`DATABASE_URL`) e das variáveis de auth; os links mágicos são capturados em arquivo via `MAGIC_LINK_CAPTURE_FILE` (somente testes), sem SMTP. Instale o Chromium do Playwright antes: `pnpm exec playwright install chromium`.
`/api/health` verifica o processo HTTP, sem afirmar disponibilidade do banco ou do SMTP.

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
| `BOOKING_HOLD_MINUTES` | `10` | Tempo de reserva aguardando o Pix (2–30). |
| `BOOKING_MAX_PENDING_PER_CLIENT` | `3` | Reservas pendentes simultâneas por cliente (IP) e negócio. |
| `BOOKING_MAX_PENDING_PER_PHONE` | `2` | Reservas pendentes simultâneas por telefone e negócio. |
| `BOOKING_MAX_PENDING_PER_BUSINESS` | `50` | Reservas pendentes simultâneas por negócio. |

Exemplos de proxy: Nginx com `proxy_set_header X-Real-IP $remote_addr;` usa o padrão. Um balanceador que anexa `X-Forwarded-For` usa `BOOKING_CLIENT_IP_HEADER=x-forwarded-for` e `BOOKING_TRUSTED_PROXY_HOPS=1`; CDN + balanceador, `2`.
Sem proxy confiável, o servidor usa o endereço do socket que o Next põe em `X-Forwarded-For`. Um cliente pode forjar esse header para escapar do próprio limite, mas não consegue esgotar o limite de outros clientes; o teto por negócio limita o total. Em produção, configure o proxy.
Endereços nunca são armazenados: só HMAC por negócio. IPv6 é agrupado por /64.

Dependência adicional: `qrcode` gera o QR Code PNG padronizado da simulação; evita implementar codificação de QR manualmente.
