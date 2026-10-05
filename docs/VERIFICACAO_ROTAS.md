# Verificação de rotas — T3 — 2026-10-04

Somente leitura de produto; inventário por arquivo e GET anônimo com identificadores inválidos/slug inexistente. Sem POST/PUT/DELETE, cookies, email, webhook ou reserva real. GET payment usa ID inválido: validação precede consulta/expiração. Rotas de auth consultadas apenas em get-session anônimo; outros subendpoints não exercitados.

HEADs observados: tests ecc62d9; backend cafc5b2; dashboard c098a7a; booking-ui5b4c3ad; conversion fa797d0. Portas convencionais3103/3000/3343/3001/3005; não há identificação de build servido, portanto HTTP não prova associação ao HEAD. Ausência de conexão não é404.200 em página dinâmica não prova existência do negócio.

## Inventário e observação por rota

PENDENTE indica método mutante não executado por instrução read-only. OK HTTP limita-se ao caso anônimo/inválido observado; não aprova autorização de tenant com sessão real. Arquivo:linha local ao projeto identificado.

| Worktree | Caminho | Método | Observado | Classe | Arquivo:linha |
|---|---|---|---|---|---|
| agenda-tests | `/api/auth/[...all]` | GET | indisponível: URLError | MELHORAR | `app/api/auth/[...all]/route.ts:5` |
| agenda-tests | `/api/auth/[...all]` | POST | não executado (mutação) | PENDENTE | `app/api/auth/[...all]/route.ts:9` |
| agenda-tests | `/api/health` | GET | indisponível: URLError | MELHORAR | `app/api/health/route.ts:1` |
| agenda-tests | `/api/public/[slug]/availability` | GET | indisponível: URLError | MELHORAR | `app/api/public/[slug]/availability/route.ts:4` |
| agenda-tests | `/api/public/[slug]/bookings/[id]/payment` | GET | indisponível: URLError | MELHORAR | `app/api/public/[slug]/bookings/[id]/payment/route.ts:4` |
| agenda-tests | `/api/public/[slug]/bookings` | POST | não executado (mutação) | PENDENTE | `app/api/public/[slug]/bookings/route.ts:4` |
| agenda-tests | `/api/public/[slug]/services` | GET | indisponível: URLError | MELHORAR | `app/api/public/[slug]/services/route.ts:4` |
| agenda-tests | `/api/webhooks/payments/[provider]` | POST | não executado (mutação) | PENDENTE | `app/api/webhooks/payments/[provider]/route.ts:4` |
| agenda-tests | `/` | GET | indisponível: URLError | MELHORAR | `app/page.tsx:1` |
| agenda-tests | `/api/businesses/[businessId]/pix-key` | GET | indisponível: URLError | MELHORAR | `app/api/businesses/[businessId]/pix-key/route.ts (ausente):1` |
| agenda-backend | `/api/auth/[...all]` | GET | 200 | OK | `app/api/auth/[...all]/route.ts:6` |
| agenda-backend | `/api/auth/[...all]` | POST | não executado (mutação) | PENDENTE | `app/api/auth/[...all]/route.ts:10` |
| agenda-backend | `/api/businesses/[businessId]/pix-key` | GET | 401 | OK | `app/api/businesses/[businessId]/pix-key/route.ts:25` |
| agenda-backend | `/api/businesses/[businessId]/pix-key` | PUT | não executado (mutação) | PENDENTE | `app/api/businesses/[businessId]/pix-key/route.ts:29` |
| agenda-backend | `/api/businesses/[businessId]/pix-key` | DELETE | não executado (mutação) | PENDENTE | `app/api/businesses/[businessId]/pix-key/route.ts:38` |
| agenda-backend | `/api/health` | GET | 200 | OK | `app/api/health/route.ts:1` |
| agenda-backend | `/api/public/[slug]/availability` | GET | 400 | OK | `app/api/public/[slug]/availability/route.ts:4` |
| agenda-backend | `/api/public/[slug]/bookings/[id]/payment` | GET | 400 | OK | `app/api/public/[slug]/bookings/[id]/payment/route.ts:4` |
| agenda-backend | `/api/public/[slug]/bookings` | POST | não executado (mutação) | PENDENTE | `app/api/public/[slug]/bookings/route.ts:4` |
| agenda-backend | `/api/public/[slug]/services` | GET | 404 | OK | `app/api/public/[slug]/services/route.ts:4` |
| agenda-backend | `/api/webhooks/payments/[provider]` | POST | não executado (mutação) | PENDENTE | `app/api/webhooks/payments/[provider]/route.ts:4` |
| agenda-backend | `/` | GET | 200 | OK | `app/page.tsx:1` |
| agenda-dashboard | `/api/auth/[...all]` | GET | 200 | OK | `app/api/auth/[...all]/route.ts:5` |
| agenda-dashboard | `/api/auth/[...all]` | POST | não executado (mutação) | PENDENTE | `app/api/auth/[...all]/route.ts:9` |
| agenda-dashboard | `/api/health` | GET | 200 | OK | `app/api/health/route.ts:1` |
| agenda-dashboard | `/api/public/[slug]/availability` | GET | indisponível: TimeoutError | MELHORAR | `app/api/public/[slug]/availability/route.ts:4` |
| agenda-dashboard | `/api/public/[slug]/bookings/[id]/payment` | GET | indisponível: TimeoutError | MELHORAR | `app/api/public/[slug]/bookings/[id]/payment/route.ts:4` |
| agenda-dashboard | `/api/public/[slug]/bookings` | POST | não executado (mutação) | PENDENTE | `app/api/public/[slug]/bookings/route.ts:4` |
| agenda-dashboard | `/api/public/[slug]/services` | GET | indisponível: TimeoutError | MELHORAR | `app/api/public/[slug]/services/route.ts:4` |
| agenda-dashboard | `/api/webhooks/payments/[provider]` | POST | não executado (mutação) | PENDENTE | `app/api/webhooks/payments/[provider]/route.ts:4` |
| agenda-dashboard | `/dashboard/customers` | GET | 200 | OK | `app/dashboard/(owner)/customers/page.tsx:1` |
| agenda-dashboard | `/dashboard` | GET | 200 | OK | `app/dashboard/(owner)/page.tsx:1` |
| agenda-dashboard | `/dashboard/services` | GET | 200 | OK | `app/dashboard/(owner)/services/page.tsx:1` |
| agenda-dashboard | `/dashboard/settings` | GET | 200 | OK | `app/dashboard/(owner)/settings/page.tsx:1` |
| agenda-dashboard | `/dashboard/login` | GET | 200 | OK | `app/dashboard/login/page.tsx:1` |
| agenda-dashboard | `/` | GET | 200 | OK | `app/page.tsx:1` |
| agenda-dashboard | `/api/businesses/[businessId]/pix-key` | GET | 404 | BLOQUEIA | `app/api/businesses/[businessId]/pix-key/route.ts (ausente):1` |
| agenda-booking-ui | `/[slug]` | GET | 200 | OK | `app/[slug]/page.tsx:1` |
| agenda-booking-ui | `/api/auth/[...all]` | GET | 200 | OK | `app/api/auth/[...all]/route.ts:5` |
| agenda-booking-ui | `/api/auth/[...all]` | POST | não executado (mutação) | PENDENTE | `app/api/auth/[...all]/route.ts:9` |
| agenda-booking-ui | `/api/health` | GET | 200 | OK | `app/api/health/route.ts:1` |
| agenda-booking-ui | `/api/public/[slug]/availability` | GET | 400 | OK | `app/api/public/[slug]/availability/route.ts:4` |
| agenda-booking-ui | `/api/public/[slug]/bookings/[id]/payment` | GET | 400 | OK | `app/api/public/[slug]/bookings/[id]/payment/route.ts:4` |
| agenda-booking-ui | `/api/public/[slug]/bookings` | POST | não executado (mutação) | PENDENTE | `app/api/public/[slug]/bookings/route.ts:4` |
| agenda-booking-ui | `/api/public/[slug]/services` | GET | 404 | OK | `app/api/public/[slug]/services/route.ts:4` |
| agenda-booking-ui | `/api/webhooks/payments/[provider]` | POST | não executado (mutação) | PENDENTE | `app/api/webhooks/payments/[provider]/route.ts:4` |
| agenda-booking-ui | `/dashboard` | GET | 200 | OK | `app/dashboard/page.tsx:1` |
| agenda-booking-ui | `/onboarding` | GET | 200 | OK | `app/onboarding/page.tsx:1` |
| agenda-booking-ui | `/` | GET | 200 | OK | `app/page.tsx:1` |
| agenda-booking-ui | `/preview/booking` | GET | 200 | OK | `app/preview/booking/page.tsx:1` |
| agenda-booking-ui | `/preview/configuracoes` | GET | 200 | OK | `app/preview/configuracoes/page.tsx:1` |
| agenda-booking-ui | `/preview/dashboard` | GET | 200 | OK | `app/preview/dashboard/page.tsx:1` |
| agenda-booking-ui | `/preview/landing` | GET | 200 | OK | `app/preview/landing/page.tsx:1` |
| agenda-booking-ui | `/preview` | GET | 200 | OK | `app/preview/page.tsx:1` |
| agenda-booking-ui | `/preview/reservas` | GET | 200 | OK | `app/preview/reservas/page.tsx:1` |
| agenda-booking-ui | `/preview/servicos` | GET | 200 | OK | `app/preview/servicos/page.tsx:1` |
| agenda-booking-ui | `/api/businesses/[businessId]/pix-key` | GET | 404 | MELHORAR | `app/api/businesses/[businessId]/pix-key/route.ts (ausente):1` |
| agenda-conversion | `/[slug]` | GET | 200 | OK | `app/[slug]/page.tsx:1` |
| agenda-conversion | `/api/auth/[...all]` | GET | 200 | OK | `app/api/auth/[...all]/route.ts:5` |
| agenda-conversion | `/api/auth/[...all]` | POST | não executado (mutação) | PENDENTE | `app/api/auth/[...all]/route.ts:9` |
| agenda-conversion | `/api/health` | GET | 200 | OK | `app/api/health/route.ts:1` |
| agenda-conversion | `/api/public/[slug]/availability` | GET | indisponível: TimeoutError | MELHORAR | `app/api/public/[slug]/availability/route.ts:4` |
| agenda-conversion | `/api/public/[slug]/bookings/[id]/payment` | GET | indisponível: TimeoutError | MELHORAR | `app/api/public/[slug]/bookings/[id]/payment/route.ts:4` |
| agenda-conversion | `/api/public/[slug]/bookings` | POST | não executado (mutação) | PENDENTE | `app/api/public/[slug]/bookings/route.ts:4` |
| agenda-conversion | `/api/public/[slug]/services` | GET | indisponível: TimeoutError | MELHORAR | `app/api/public/[slug]/services/route.ts:4` |
| agenda-conversion | `/api/webhooks/payments/[provider]` | POST | não executado (mutação) | PENDENTE | `app/api/webhooks/payments/[provider]/route.ts:4` |
| agenda-conversion | `/dashboard` | GET | indisponível: TimeoutError | MELHORAR | `app/dashboard/page.tsx:1` |
| agenda-conversion | `/login` | GET | 200 | OK | `app/login/page.tsx:1` |
| agenda-conversion | `/onboarding` | GET | 200 | OK | `app/onboarding/page.tsx:1` |
| agenda-conversion | `/` | GET | 200 | OK | `app/page.tsx:1` |
| agenda-conversion | `/preview/booking` | GET | indisponível: TimeoutError | MELHORAR | `app/preview/booking/page.tsx:1` |
| agenda-conversion | `/preview/configuracoes` | GET | indisponível: TimeoutError | MELHORAR | `app/preview/configuracoes/page.tsx:1` |
| agenda-conversion | `/preview/dashboard` | GET | 200 | OK | `app/preview/dashboard/page.tsx:1` |
| agenda-conversion | `/preview/landing` | GET | 200 | OK | `app/preview/landing/page.tsx:1` |
| agenda-conversion | `/preview` | GET | 200 | OK | `app/preview/page.tsx:1` |
| agenda-conversion | `/preview/reservas` | GET | 200 | OK | `app/preview/reservas/page.tsx:1` |
| agenda-conversion | `/preview/servicos` | GET | 200 | OK | `app/preview/servicos/page.tsx:1` |
| agenda-conversion | `/api/businesses/[businessId]/pix-key` | GET | 404 | MELHORAR | `app/api/businesses/[businessId]/pix-key/route.ts (ausente):1` |

## Problemas e responsabilidades

- **BLOQUEIA integração Pix do painel — T1/T2:** `/api/businesses/[businessId]/pix-key` GET404 em3343; handler ausente no snapshot dashboard. Consumidor real `agenda-dashboard/components/dashboard/pix-key-form.tsx:26,30,49,64` chama essa origem para GET/PUT/DELETE. Backend possui handler `agenda-backend/app/api/businesses/[businessId]/pix-key/route.ts:25,29,38`;3000 retorna401 anônimo, proteção esperada. Corrigir integração com rota/origem autorizada; pronto exige GET autenticado por tenant e PUT/DELETE com origem válida em DB sintético. Não atribuir401 a erro de produto.
- **MELHORAR fragmentação de rotas — coordenação T1/T2/T4/T5:** `/dashboard` real existe só em dashboard (route group owner); booking-ui e conversion possuem placeholder em `app/dashboard/page.tsx:8,76`. Raiz, onboarding e Preview duplicados entre booking-ui/conversion. Não são colisões dentro de um build; viram conflito de integração se combinados sem escolha do dono. Definir origem/rota canônica e substituir placeholder ao integrar; não editar nesta verificação.
- **MELHORAR prova de infraestrutura — operador/T3:**3103 recusou conexão; alguns GET3343/3005 excederam3s. Timeout não comprova404 nem falha permanente. Nenhuma alteração de serviço realizada. Revalidar apenas rotas afetadas com ambiente/commit identificado; não aprovar dinheiro/tenant por HTML200.
- **OK, limitado ao teste negativo:** GET services com slug inexistente404 em3000/3001 é esperado. Payment com ID inválido400 e availability com parâmetros inválidos400 não comprovam leitura autorizada de tenant. Pix-key anônimo401 em3000 é esperado; cópias ausentes nos frontends404 exigem integração apenas se consumidas naquela origem.

## Métodos e cobertura pendente

78 linhas de inventário:35 respostas200,4 respostas400,1 resposta401,5 respostas404;7 conexões indisponíveis,9 timeouts;17 métodos mutantes não executados. Contagem mede linhas/métodos, não endpoints distintos. Auth catch-all resume GET/POST; seus subendpoints têm comportamentos distintos e não foram todos acionados. POST booking, POST webhook e PUT/DELETE Pix existem nos arquivos indicados, mas permanecem pendentes por read-only. GET em endpoint POST-only não foi usado para inferir comportamento do método correto.

Todos os cinco snapshots contêm cópias das APIs públicas/auth/health/webhook; somente backend contém handler Pix-key. Repetição entre worktrees é esperada durante desenvolvimento, mas provas devem identificar origem/commit para evitar aprovação da cópia errada. Não há duplicação física de rota identificada dentro de cada worktree nesta enumeração.

Comandos reais: `rg --files .../app` e busca dos exports de métodos; leitura focal dos handlers e consumidores; `python3 dogfood-output/verify-routes.py` com GET urllib, timeout3s, sem imprimir corpos/cookies/segredos. Resultados brutos próprios: `dogfood-output/verify-routes-results.json`. Nenhum gate geral ou fluxo bancário executado. Classificações descrevem somente observação e limites acima; estados autenticados/tenant cruzado, payloads, concorrência/idempotência e confirmação real exigem ambiente sintético autorizado na fila B-06/B-05.
