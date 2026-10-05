# B-02 — Autoridade de processo

Proposta consultiva. Sem implementação. Base pedida: `agenda-backend` `0d6858f`. Heads lidos agora: dashboard `b046430`, booking-ui `5b4c3ad`, conversion `3ac321b`. `lib/auth.ts` do backend está modificado na árvore e não entra como entrega.

## Recomendação

Um processo aplica auth, webhook, reserva e chave Pix: o Next de `agenda-backend`, porta 3000.

Só esse processo mantém:

- `app/api/auth/[...all]/route.ts`
- `app/api/public/[slug]/services|availability|bookings`
- `app/api/public/[slug]/bookings/[id]/payment`
- `app/api/webhooks/payments/[provider]/route.ts`
- `app/api/businesses/[businessId]/pix-key/route.ts`
- `lib/auth.ts`, `lib/payments`, `lib/bookings`, `lib/pix-key`

Os Next de dashboard (3343), booking-ui (3001) e conversion (3005) ficam UI. Eles chamam a origem do backend. Não carregam cópia de auth nem de pagamento.

O logger seguro commitado está em `agenda-backend/lib/auth.ts:16`. A árvore de trabalho acrescenta `onAPIError` em `lib/auth.ts:19-28`; isso pertence ao B-01 e só vale depois do commit. As outras três cópias não têm `logAuthEvent`:

- `agenda-dashboard/lib/auth.ts:11-17`
- `agenda-booking-ui/lib/auth.ts:19-25`
- `agenda-conversion/lib/auth.ts:19-25`

Booking-ui e conversion ainda aceitam `BETTER_AUTH_TRUSTED_ORIGINS` (`lib/auth.ts:14-17` em cada um). Backend e dashboard confiam só na origem de `BETTER_AUTH_URL` (`lib/auth.ts:17` no commit `0d6858f`; dashboard `lib/auth.ts:15`).

## Como remover as cópias

1. T1 publica a URL do backend e a lista de origens de UI. A checagem de origem permanece ligada.
2. T2, T4 e T5 apontam login, reserva e chave Pix para essa URL. O painel hoje chama caminho relativo em `agenda-dashboard/components/dashboard/pix-key-form.tsx`. A rota `GET/PUT/DELETE` existe só no backend, `route.ts:25`, `route.ts:29` e `route.ts:38`.
3. Com o consumo provado, T2, T4 e T5 apagam `app/api/auth`, `app/api/public`, `app/api/webhooks` e os módulos `lib/auth.ts` e `lib/payments`. Health local pode ficar.
4. `scripts/run_system.py:149` deixa de definir `BETTER_AUTH_URL` em cada processo novo. Essa variável fica só no backend.

Não apagar as rotas antes do cliente apontar para o backend. Não copiar o logger para três servidores como solução permanente.

## Impacto

- T1: dono do processo autoridade, da lista de origens e do launcher.
- T2: painel consome auth e pix-key do backend; depois remove a API local.
- T3: prova um webhook, uma reserva e o 404 das cópias. Prova que o handler do backend não imprime token, SQL nem email.
- T4: booking e Preview consomem a API pública do backend; depois removem a cópia.
- T5: login e onboarding usam o mesmo auth. Simulação continua só em `/preview`.
- T6: sem mudança visual nesta decisão.

## Critério

Um processo recebe o webhook e cria a reserva. Os outros três respondem 404 nessas rotas. O painel grava a chave no backend e recebe só type e hint. Fake continua recusado em produção (`lib/payments/index.ts:7` no backend).

## Riscos

Dois webhooks no mesmo banco, durante a transição, podem processar o mesmo evento duas vezes. A idempotência existe, mas a cópia sem o logger ainda vaza erro. Cookie de sessão preso ao host errado impede o painel de enxergar a sessão do backend. Apagar a API local cedo derruba Preview e landing.

## Reversão

Antes de apagar, marcar o commit de cada worktree. Reverter é restaurar esses arquivos nesse commit. Não há merge nesta proposta.
