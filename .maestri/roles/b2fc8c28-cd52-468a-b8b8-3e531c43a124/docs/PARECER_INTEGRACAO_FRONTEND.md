# Parecer de integração — refatoração de frontend

Somente leitura. 2026-10-04. Heads: backend `c407968`, dashboard `7175251`, booking-ui `1d46011`, conversion `cb3ce31`, ux-audit `a134216`. Gates de lint, typecheck e test relatados pelo Hermes; não repeti. Executado aqui: 7 GET de status, leitura de código. Nenhum POST de reserva, webhook ou chave.

## RESULTADO — BLOQUEIA

Não está tudo certo. A autoridade 3000 existe e os consumidores apontam para ela. As cópias locais continuam vivas.

## Provas

GET sem cookie, timeout 6 s:

| Rota | 3000 | 3001 | 3005 | 3343 |
| --- | --- | --- | --- | --- |
| `/api/auth/get-session` | 200 | 200 | 200 | 500, corpo vazio |
| `/api/public/barbearia-demo/services` | 200 (anterior) | 200 | 200 | 400 |

Auth local responde fora do backend. Em 3343 devolve 500 sem o saneamento do backend.

## Itens, dono e critério

1. BLOQUEIA — cópias de reserva e auth não são 404 nem proxy em todos.
   - Conversion: `app/api/public/[slug]/bookings/route.ts:5` chama `createBooking` local. Grava no banco do próprio processo. Dono T5. Pronto: proxy ao 3000 ou remoção.
   - Booking-ui: `8a8cf4a` transformou services, availability, bookings e payment em proxy. Encaminha `idempotency-key`, `authorization` e a query. `lib/auth.ts` e `app/api/auth` continuam. Dono T4.
   - Dashboard: `app/api/auth`, `app/api/public` e `app/api/webhooks` continuam, apesar de `lib/dashboard/auth-session.ts:12` usar a sessão do backend. Dono T2.

2. BLOQUEIA — receptor de webhook local. `app/api/webhooks/payments/[provider]/route.ts:2` em booking-ui chama `processWebhook` local. Mesma rota existe em dashboard e conversion. Dois receptores no mesmo banco confirmam pagamento fora da autoridade. Não executei POST. Dono: T4, T2, T5 removem; T1 mantém só o 3000. Pronto: POST assinado nas três portas → 404.

3. MELHORAR — origem fora de dev. `lib/origins.ts:8-9` do backend só lista as quatro portas fora de produção. Conversion fixa `callbackURL = "http://localhost:3343/dashboard"` em `lib/magic-link.ts`. O cookie de sessão funciona entre portas porque cookie não isola por porta em `localhost`. Em domínio de produção isso quebra. Dono T1 (origem única) e T5 (callback por env).

4. MELHORAR — tokens. T5 `globals.css:12-29` repete lima, floresta e durações de T4 (`538f6a3`). T2 mantém `agenda-dashboard/app/globals.css:6` em `#1d4ed8`. O login do painel usa `var(--accent-lime, #c0f739)` em `login-form.module.css:9`; `--accent-lime` não existe no `globals.css` do dashboard, então vale o fallback. É cópia, não consumo. Painel autenticado segue azul. Dono T2; T4 entrega o bloco. Contrato: `docs/CONTRATO-TOKENS.md`.

5. MELHORAR — relatório de T4. `d61f7eb` não existe. `StepSlot.tsx` e `PreviewNav.tsx` têm último commit em `538f6a3`; árvore rastreada limpa. T4-B e T4-C não aparecem como mudança commitada. `docs/evidencias/` untracked. Dono T4.

6. MELHORAR — duplicação de booking. Conversion mantém `components/booking` e `[slug]`, com fetch relativo em `BookingFlow.tsx:105`. Dono T5 remove ou consome o de T4.

7. MELHORAR — documentos. T6: relatório T6-A cita `206a5a3`; o correto é `9e24951`. Auditorias T6 e T2 untracked. Dono T6 e T2.

## OK

Proxies de booking-ui preservam idempotência, bearer e `no-store`. O dashboard trata falha da autoridade sem fingir logout. Pix-key do painel chama a 3000 com credencial. Magic link do conversion não simula fora de `/preview`.

## Ordem mínima

1. T1: origem de produção única e documentada.
2. T4, T5, T2: remover ou proxiar auth, reserva e webhook locais.
3. T3: provar webhook só no 3000, reserva 3001→3000 e 404 nas cópias.
4. T2: consumir tokens de T4 no painel autenticado.
5. T4, T6, T2: corrigir relatórios e versionar evidências.
