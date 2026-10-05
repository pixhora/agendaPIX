# Auditoria de integração — cursor-tech-lead

RESULTADO — BLOQUEIA. Sem implementação. Sessão `fe2369fe-238e-4d90-b7ea-c5f8d2429cf4`.

Repo `feat/backend` HEAD `0d6858f`. Dashboard `daf70ee`. Booking-ui `88a4d49`. Conversion `3ac321b`. Docs locais sujos. Não commitado.

Estado: auth PARCIAL. Tenant da chave Pix PARCIAL. Booking/disponibilidade PARCIAL. Pix/webhook MOCK. Gateway real AUSENTE. Launcher PARCIAL.

1. BLOQUEIA. O painel chama `/api/businesses/{id}/pix-key` em `agenda-dashboard/components/dashboard/pix-key-form.tsx:26`. A rota existe só em `agenda-backend/app/api/businesses/[businessId]/pix-key/route.ts`. Dashboard e booking-ui não têm a rota. Painel na 3343 e backend na 3000: o PUT não alcança a cifra. Dono: T1 no processo que o painel chama. T2 não inventa cifra. Pronto: dono recebe só type/hint; alheio 404; ciphertext fora da resposta.

2. BLOQUEIA. O backend filtra log em `lib/auth.ts` e `lib/auth-logger.ts`. O diff de `daf70ee` e de `88a4d49` contra `0d6858f` remove esse logger. Os dois processos expõem `/api/auth`. Dono: T2 e T4 recolocam o wrapper. T3 prova que token, SQL e email não saem no handler real.

3. MELHORAR. `scripts/run_system.py:149` define `BETTER_AUTH_URL` com a porta de cada processo novo. Backend e dashboard confiam só nessa origem. Booking-ui aceita `BETTER_AUTH_TRUSTED_ORIGINS`. Dono: T1. Não desligar a checagem. Pronto: POST do painel não recebe 403 só por porta.

4. MOCK. `lib/payments/index.ts:5-8` aceita só fake e recusa produção. `lib/payments/rules.ts:16-19` confirma só com `payment.paid` autenticado, valor igual e prazo válido. Chave Pix não liquida. Dono: T1 após gateway do humano.

5. MELHORAR. Quatro Next locais repetem API pública e webhook. `lib/payments` não divergiu entre `0d6858f` e `88a4d49`. Auth divergiu. Dono: T1 escolhe o processo autoridade.

OK nesta rodada: login do dashboard usa `authClient`, `callbackURL /dashboard` e `errorCallbackURL /dashboard/login?error=link`. Conversão simula sucesso só em `/preview` (`agenda-conversion/lib/magic-link.ts:16-33`). Animações A1–A3 não mudam dinheiro.

Checks: `python3 -m py_compile scripts/run_system.py` ok. `python3 scripts/run_system.py --check` exit 1. Backend 3000, Preview 3001, Landing 3005 e Painel 3343 indisponíveis. `pnpm test`, `test:db` e `build` não rodados. Sem segredo. Sem merge/push.
