# Testes end-to-end (Playwright)

Suíte em `tests/e2e/`, dois projetos: **mobile** (390×844, perfil iPhone 13 no Chromium) e **desktop** (1440×900).

| Arquivo | Cobre |
| --- | --- |
| `booking.spec.ts` | Página pública: serviço → dia/horário → nome, WhatsApp e CPF → Pix (QR PNG + copia-e-cola do contrato `PixCharge`, provedor fake) → webhook assinado → "Horário confirmado!"; também cobre expiração do hold; axe em cada etapa |
| `owner-journeys.spec.ts` | Login por link mágico (`/login` → `/dashboard`, link reutilizado volta com aviso) e onboarding completo → painel |
| `painel.spec.ts` | Agenda do dia (KPIs, detalhe no painel lateral), semana/navegação/calendário, cadastro de serviço, clientes, configurações (horários e link público), isolamento entre negócios (A não vê B, inclusive na API da chave Pix) |
| `dashboard-owner.spec.ts`, `dashboard-login.spec.ts` | Redirecionamentos, cabeçalhos e acesso negado |
| `a11y.spec.ts` | axe (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) e reflow sem rolagem horizontal na landing, login, onboarding, página pública e painel; tema escuro; alternador de tema persistente |
| `skeleton.spec.ts` | Landing e `/api/health` |

## Rodar localmente

```bash
pnpm install
pnpm exec playwright install chromium        # uma vez (no CI: --with-deps)
DATABASE_URL=postgresql://USER:SENHA@127.0.0.1:5432/agenda_e2e pnpm db:migrate
pnpm test:e2e                                 # ou: pnpm exec playwright test --project=mobile
```

Os specs novos importam `test` de `tests/e2e/helpers.ts`, que esconde o indicador do `next dev` (`nextjs-portal`, só existe em desenvolvimento e cobre o canto inferior esquerdo no celular). `expectNoAxeViolations` roda as regras WCAG A/AA e lista regra, alvo e motivo; `target-size` roda à parte com as barras sticky do painel no fluxo.

O `webServer` do `playwright.config.ts` sobe `pnpm exec next dev --hostname 127.0.0.1 --port 3344` e força `BETTER_AUTH_URL=http://127.0.0.1:3344`, `PAYMENT_PROVIDER=fake` e `MAGIC_LINK_CAPTURE_FILE=tests/e2e/.auth/magic-link-runtime.txt` (os links mágicos vão para esse arquivo; SMTP não é usado). Fora do CI ele reaproveita um servidor que já esteja na porta.

`tests/e2e/global-setup.ts` cria, a cada execução, dois donos e dois negócios (A com reserva confirmada às 07:00 e uma cancelada às 08:00 no mesmo dia, B de outro dono), gera a sessão do dono A em `tests/e2e/.auth/owner.json` e grava `meta.json`. Não precisa de seed.

## Requisitos para um job de CI

- **Postgres 17** acessível (ex.: service container `postgres:17`), banco vazio migrado com `pnpm db:migrate` antes dos testes.
- **Porta 3344** livre no runner.
- Variáveis de ambiente (valores de teste):

| Variável | Valor no CI |
| --- | --- |
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5432/agenda_e2e` (o do service) |
| `BETTER_AUTH_SECRET` | segredo aleatório com 32+ caracteres (não pode começar com `replace-this-`) |
| `BETTER_AUTH_URL` | `http://127.0.0.1:3344` (o global setup usa esse valor para gerar a sessão) |
| `PAYMENT_PROVIDER` | `fake` |
| `FAKE_WEBHOOK_SECRET` | qualquer segredo (a spec de agendamento assina o webhook com ele) |
| `PIX_KEY_ENCRYPTION_KEY` | 64 caracteres hexadecimais (ex.: `openssl rand -hex 32`), validado em `lib/pix-key/crypto.ts` |
| `CI` | `true` (liga 1 retry, relatório HTML e impede reaproveitar servidor) |

- Passos: `pnpm install --frozen-lockfile` → `pnpm exec playwright install --with-deps chromium` → `pnpm db:migrate` → `pnpm test:e2e`.
- Artefatos úteis: `playwright-report/` e `test-results/` (traces só de falhas).
- Tempo local: ~2 min para os 62 testes (31 por projeto) com o servidor já compilado e ~5 min a frio, com `workers: 1`. A suíte é serial de propósito: as jornadas de link mágico compartilham um único arquivo de captura.
