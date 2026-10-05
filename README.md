# Agenda

Esqueleto do produto de agendamento com sinal por Pix. Os fluxos comerciais ainda não estão implementados.


## Painel do dono (app único)

A branch `feat/dashboard-v2` incorpora o painel do dono no mesmo app Next do backend (`feat/backend` como base). Não use o modelo antigo de painel em porta `3343` falando HTTP com autoridade separada. Sessão: Better Auth no mesmo processo. O PR #1 (`feat/dashboard`) permanece histórico e não deve ser atualizado por esta linha de trabalho.

## Requisitos

- Node.js 22.16 ou superior e pnpm 12.8.1.
- Podman com um provedor Compose instalado. `podman compose version` deve funcionar; não é necessário ter o daemon Docker.
- SMTP configurado para testar o envio de links de acesso. O build e os testes unitários não dependem de SMTP ou Postgres.

## Desenvolvimento

### Iniciar as worktrees com Python

Na organização local com as quatro worktrees irmãs instaladas:

```bash
python3 scripts/run_system.py
```

O launcher inicia backend (`3000`), Preview (`3001`), landing (`3005`) e painel (`3343`). Reutiliza servidores da mesma worktree já ativos e recusa portas ocupadas por processos desconhecidos. Aguarda HTTP 200 nas rotas indicadas; falha se uma rota não responder no prazo. As worktrees são versões de desenvolvimento separadas: iniciar todas não integra suas branches automaticamente.

```bash
python3 scripts/run_system.py --check          # Apenas verifica disponibilidade
python3 scripts/run_system.py --with-db        # Também executa o Compose existente
python3 scripts/run_system.py --timeout 180    # Mais tempo para compilação inicial
python3 scripts/run_system.py --root /caminho/projetos
```

Requisitos adicionais: Python 3.9+, Linux com `ss`, dependências pnpm instaladas em cada worktree. Configure `.env`/ambiente dos serviços conforme necessário; o launcher não copia credenciais entre worktrees. Nos processos novos, `BETTER_AUTH_URL` recebe a origem local da respectiva porta. Processos reaproveitados mantêm sua configuração.

Ctrl+C encerra apenas os servidores iniciados pelo launcher. Banco e servidores anteriores permanecem. Logs novos ficam em `.maestri/run-system-logs/`, com arquivos privados; não publique tokens ou dados pessoais dos logs.

O launcher não instala dependências, aplica migrations, roda seed ou configura SMTP/provider. Execute migrations explicitamente quando necessárias. O Compose atual contém somente PostgreSQL; email real exige SMTP configurado. Preview e Pix fake continuam simulações, mesmo com todas as URLs disponíveis.

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
