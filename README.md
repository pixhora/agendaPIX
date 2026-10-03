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
Os testes Playwright cobrem a página do esqueleto em 375 px, autenticação e o fluxo HTTP real de agendamento com Pix fake. Veja a execução abaixo.
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

## Testes e2e de agendamento e Pix

Use um banco PostgreSQL exclusivo para testes, com as migrations aplicadas. Configure `.env` com `DATABASE_URL`, `BETTER_AUTH_SECRET` e `FAKE_WEBHOOK_SECRET` (segredos exclusivos, com pelo menos 32 caracteres; não use os valores `replace-this-` do exemplo). As variáveis exportadas no terminal têm precedência sobre `.env`.

```bash
pnpm install --frozen-lockfile
# Na primeira configuração, copie .env.example para .env e ajuste banco e segredos.
# Configure POSTGRES_PORT livre e a mesma porta em DATABASE_URL.
pnpm db:up
pnpm db:migrate
pnpm exec playwright install chromium
pnpm test:e2e
```

O Playwright inicia e encerra seu próprio Next.js em `http://127.0.0.1:3103`, força `PAYMENT_PROVIDER=fake` e configura a origem de autenticação para esse endereço. Deixe a porta 3103 livre; um servidor existente não será reutilizado. O fake funciona somente fora de produção e não movimenta dinheiro real. SMTP não é necessário para os cenários atuais.

`tests/e2e/booking-pix.spec.ts` consulta serviços e disponibilidade, cria reserva, verifica QR Code/copia-e-cola fictícios, envia webhook HMAC e consulta confirmação. Também verifica rejeição de horário ocupado sem nova reserva/cobrança, repetição do mesmo evento e novo evento para um pagamento já pago. As duplicatas preservam o registro de pagamento e cada entrega fica auditada.

Cada teste cria um negócio com UUID exclusivo e remove somente seus próprios dados no encerramento, sem truncar tabelas ou remover volumes. Uma interrupção forçada do processo pode deixar dados de teste; mantenha esse banco separado de dados reais. As rotas HTTP e a persistência são reais; a assinatura do webhook é calculada no teste, sem substituir handlers ou regras de negócio.

A tela pública `/[slug]` ainda não está implementada nesta base. Estes cenários verificam o fluxo pelas APIs usando `APIRequestContext` do Playwright; não comprovam a interação visual de agendamento. A verificação visual atual cobre somente o esqueleto em 375 px.

Para incluir o fluxo visual com a interface do Terminal 4 em execução, rode `QA_BOOKING_UI_URL=http://127.0.0.1:3001 pnpm test:e2e`. O cenário adicional cria dados isolados no Postgres e encaminha as chamadas públicas do navegador ao backend real iniciado em 3103, sem respostas mockadas. Confirma o Pix fake via webhook HMAC e verifica a reserva persistida. É uma ponte de QA entre branches; não substitui testar a versão integrada no mesmo servidor. Sem `QA_BOOKING_UI_URL`, somente esse cenário é marcado como não executado.

Para estados controlados da interface e preview, use `PREVIEW_BASE_URL=http://127.0.0.1:3001 pnpm exec playwright test --config tests/qa/playwright.config.ts` e `PREVIEW_BASE_URL=http://127.0.0.1:3001 pnpm exec playwright test --config tests/qa/preview.config.ts`. A primeira suíte simula respostas HTTP para loading/erro/vazio/expiração; a segunda usa dados locais do preview e observa chamadas externas HTTP e APIs. O servidor da interface deve estar disponível; essas configurações não iniciam serviços. Artefatos ficam em `dogfood-output/`.
