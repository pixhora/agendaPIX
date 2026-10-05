# Verificação de rotas — integração

Somente leitura. 2026-10-04. Heads: backend `cafc5b2` (3000), dashboard `c098a7a` (3343), booking-ui `5b4c3ad` (3001), conversion `fa797d0` (3005). HTTP sem cookie, timeout curto. Nenhum POST de reserva, webhook ou chave. Contrato: `docs/CONTRATOS.md`.

## Rotas de contrato

| Rota | Quem serve | Observado | Problema | Classe |
| --- | --- | --- | --- | --- |
| `GET /api/health` | os quatro | 200 `{"status":"ok"}` em 3000, 3001, 3005 e 3343 | Contrato em `CONTRATOS.md:56` descreve um processo. Quatro cópias. | melhorar |
| `GET/POST /api/auth/[...all]` | os quatro | Não chamei magic-link. Código: backend usa `handleHttp` em `app/api/auth/[...all]/route.ts:7` e `:11`. Dashboard, booking-ui e conversion chamam `getAuth().handler` direto em `route.ts:6` e `:10`. | Só o backend tem o saneamento do `02c5b27`. As outras três cópias de `lib/auth.ts` não têm `onAPIError` nem `onResponse`. | bloqueia |
| `GET /api/businesses/{id}/pix-key` | só backend | 3000 sem sessão: 401. 3001, 3005 e 3343: 404 | Rota em `agenda-backend/.../pix-key/route.ts:25`. Ausente nos outros três. O painel chama caminho relativo. | bloqueia |
| `PUT /api/businesses/{id}/pix-key` | só backend | Não executado (mutação). Código: `route.ts:29` | Mesma ausência. Contrato `CONTRATOS.md:63`. | bloqueia |
| `DELETE /api/businesses/{id}/pix-key` | só backend | Não executado. Código: `route.ts:38` | Mesma ausência. Contrato `CONTRATOS.md:64`. | bloqueia |
| `GET /api/public/[slug]/services` | os quatro | 200 em 3000 e 3001 para `barbearia-demo`. 3005 e 3343 não chamados. | Quatro servidores podem responder a mesma reserva. Handler em `route.ts:4` de cada worktree. | bloqueia |
| `GET /api/public/[slug]/availability` | os quatro | Não chamado. Código: `route.ts:4` em cada um. | Duplicação do mesmo contrato `CONTRATOS.md:112`. | bloqueia |
| `POST /api/public/[slug]/bookings` | os quatro | Não chamado. Código: `route.ts:4` em cada um. | Dois processos no mesmo banco podem criar reservas. | bloqueia |
| `GET /api/public/[slug]/bookings/[id]/payment` | os quatro | Não chamado. Código: `route.ts:4` em cada um. | Consulta de pagamento repetida. | melhorar |
| `POST /api/webhooks/payments/[provider]` | os quatro | Não chamado. Código: `route.ts:4` em cada um. | Quatro receptores podem confirmar pagamento. | bloqueia |

## Páginas observadas

| Rota | Processo | Observado | Problema | Classe |
| --- | --- | --- | --- | --- |
| `GET /` | backend 3000 | 200 HTML | Página de esqueleto, como `CONTRATOS.md:55`. | ok |
| `GET /[slug]` | booking-ui 3001 | 200 em `/barbearia-demo` | Página pública existe aqui. Conversion também tem `app/[slug]/page.tsx`. | melhorar |
| `GET /preview` | booking-ui 3001 | 200 | Preview, não é a API de produção. | ok |
| `GET /login` | conversion 3005 | 200 | Segundo login, ao lado de `/dashboard/login`. | melhorar |
| `GET /onboarding` | conversion 3005 | 200 | Fora do contrato de API. | ok |
| `GET /dashboard/login` | dashboard 3343 | 200 HTML | Login real deste checkout. | ok |
| `GET /dashboard`, `/services`, `/customers`, `/settings` | dashboard 3343 | 200 sem cookie. HTML não contém "Seu painel"; contém `dashboard/login`. | `lib/dashboard/session.ts:9` pede `redirect`. A resposta observada não foi 307. Conteúdo de dono não apareceu neste GET. | melhorar |

## Conclusão

BLOQUEIA na integração: chave Pix só no backend, enquanto o painel está na 3343; auth saneada só no backend; reserva e webhook existem nos quatro Next.
