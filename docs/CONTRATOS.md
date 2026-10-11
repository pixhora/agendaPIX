# Contratos de agendamento e pagamento

## Escopo e estado

Esta versão inclui a base técnica e o fluxo público de reserva com Pix simulado.
Rotas implementadas e seus formatos estão documentados abaixo. Painel, interface pública e gateway real ainda dependem dos próximos trabalhos.

## Convenções

- Identificadores de domínio: UUID. Identificadores do Better Auth: texto gerado pela biblioteca.
- Dinheiro: inteiro em centavos de BRL, entre 0 e 2.147.483.647. Cobranças precisam ser maiores que zero.
- Datas de eventos: `timestamptz`, enviadas futuramente em ISO 8601 com fuso explícito.
- Horários de funcionamento: hora local do negócio. Fuso inicial: `America/Sao_Paulo`.
- `created_at` tem padrão no banco. `updated_at` é atualizado pelo Drizzle/Better Auth; SQL direto deve atualizar esse campo explicitamente.
- Campos públicos futuros usam camelCase; nomes físicos das colunas usam snake_case.

## Schema de domínio

Tabelas de domínio têm `id`, `created_at` e `updated_at`. Tabelas de auditoria têm `id` e `created_at`; cada entrega é um registro independente.

| Tabela | Campos principais | Regras |
| --- | --- | --- |
| `businesses` | `owner_id`, `name`, `slug`, `timezone`, `logo_url` | Dono referencia `user`; slug único em minúsculas, números e hífens; nome não vazio. `logo_url` é nulo ou `https` com caminho. |
| `business_slug_history` | `old_slug`, `business_id`, `created_at`, `released_at` | `old_slug` é único. `released_at` nulo redireciona. Preenchido: 404 e bloqueio de 90 dias para os outros. O negócio de origem recupera o seu no PATCH enquanto o bloqueio vale. |
| `business_pix_keys` | `business_id`, `type`, `ciphertext`, `nonce`, `key_version`, `hint`, `deactivated_at`, `deactivation_reason` | Uma chave por negócio. A migration adiciona `deactivated_at` e `deactivation_reason` e marca as linhas existentes como inativas (`deactivation_reason = pix_key_retired`). Não apaga ciphertext. A chave não entra em cobrança nem em payload. |
| `services` | `business_id`, `name`, `duration_minutes`, `price_cents`, `deposit_cents`, `active` | Duração positiva; preço e sinal não negativos; sinal não supera preço. |
| `business_hours` | `business_id`, `weekday`, `opens_at`, `closes_at` | Domingo = 0; sábado = 6; um intervalo por dia; abertura anterior ao fechamento. Ausência do dia significa fechado. |
| `customers` | `business_id`, `name`, `phone`, `email` opcional | Telefone normalizado em E.164, único dentro do negócio; sem CPF ou endereço. |
| `bookings` | `business_id`, `service_id`, `customer_id`, `starts_at`, `ends_at`, `price_cents`, `deposit_cents`, `status`, `expires_at` opcional | Serviço e cliente do mesmo negócio; início anterior ao fim; preço e sinal são cópias do valor contratado, não mudam quando o serviço muda. Reserva pendente exige vencimento posterior à criação. |
| `payments` | `business_id`, `booking_id`, `provider`, `external_id` opcional, `idempotency_key`, `amount_cents`, `status`, `paid_at` opcional, `expires_at` | Agendamento do mesmo negócio; valor positivo; chave de idempotência única; identificador externo único por provedor; pagamento pago exige data de confirmação. |

Estados de agendamento: `pending_payment`, `confirmed`, `cancelled`, `expired`, `completed`.
Estados de pagamento: `pending`, `paid`, `expired`, `failed`, `refunded`.
Os enums limitam valores armazenados. O fluxo atual cria reservas, expira pendências e confirma por webhook; integração real e demais transições serão implementadas depois.
Sinal zero é permitido no serviço, mas não cria cobrança de valor zero.

## Autenticação e isolamento

Tabelas `user`, `session`, `account` e `verification` seguem Better Auth. Sessões e contas referenciam o usuário.
`account` tem identidade única por provedor e conta externa. `verification` guarda o hash do token de link mágico.

Cada query futura do painel deve validar a sessão e filtrar pelo negócio pertencente ao usuário autenticado.
`findOwnedBusiness` exige o identificador do negócio e o usuário obtido da sessão; retorna `null` para negócio alheio ou inexistente.
`ownerId` nunca deve vir de um formulário ou corpo HTTP.
Chaves estrangeiras compostas impedem relacionar um agendamento a serviço/cliente alheio ou um pagamento a agendamento alheio.
Essas chaves protegem referências; não substituem autorização de leitura. Rotas públicas expõem apenas serviços e horários; dados da reserva exigem token de acesso.
Os testes com Postgres exercitam a consulta por dono e as referências cruzadas entre negócios.

Exclusões de domínio usam `RESTRICT` para evitar perda silenciosa de histórico financeiro.
A exclusão de conta e a política de retenção LGPD ainda precisam de definição do humano; não há endpoint destrutivo nesta etapa.

## Rotas implementadas

| Método e rota | Comportamento |
| --- | --- |
| `GET /` | Página provisória do esqueleto. |
| `GET /api/health` | `200` com `{ "status": "ok" }`; saúde do processo HTTP, sem consultar dependências. |
| `GET/POST /api/auth/[...all]` | Handler do Better Auth. Validação de entrada e de origem feita pela biblioteca. |
| `POST /api/auth/sign-in/magic-link` | Recebe email e callback; envia link por SMTP configurado. |
| `GET /api/auth/magic-link/verify` | Consome link válido e cria sessão. |
| `GET /api/auth/get-session` | Sessão atual ou ausência de sessão. |
| `POST /api/auth/sign-out` | Encerra a sessão atual. |
| `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS /api/businesses/{businessId}/pix-key` | Qualquer método responde `410` `{ "error": { "code": "pix_key_retired" } }`. Não lê o corpo, não grava e não devolve a chave nem o hint. |

A configuração é validada com Zod quando usada. Build não abre conexão ao banco nem exige segredos.
Solicitação de link com SMTP inválido falha; nunca simula envio nem revela link no terminal.
Falhas inesperadas de SMTP/adapter e `APIError` interno no handler de autenticação respondem `500` com `{ "code": "AUTHENTICATION_FAILED", "message": "Não foi possível concluir o acesso. Tente novamente." }`. O hook nativo `onAPIError` transforma erros inesperados antes do catch do Better Call; `onResponse` saneia também respostas 5xx produzidas diretamente por endpoints, preservando status/cookies e forçando JSON com `Cache-Control: no-store`. O console recebe apenas uma mensagem fixa, sem erro bruto, stack, SQL, token ou email. Erros esperados de autenticação conservam status e formato do Better Auth, incluindo validação, origem proibida e redirecionamentos. A verificação de origem fica explicitamente habilitada, inclusive nos testes.
Falha ao inicializar a configuração de auth/banco responde `503` no Route Handler com `{ "error": { "code": "auth_unavailable", "message": "O acesso está indisponível. Tente novamente mais tarde." } }` e `Cache-Control: no-store`; nenhum segredo/configuração é publicado.
A chave Pix antiga permanece no banco, inativa. Nenhum payload a trata como ativa. Cobrança de sinal usa a conta Mercado Pago do negócio.

Um QR estático/copia-e-cola Pix contém a própria chave de recebimento, necessária para o pagador enviar o dinheiro. A chave não deve aparecer no catálogo público; gerá-la como cobrança não prova liquidação. Reserva só confirma por evento autenticado do provedor. Confirmação manual vs. provedor ainda aguarda decisão do humano.

## Rotas previstas

| Área | Rotas propostas | Responsável |
| --- | --- | --- |
| Página pública | `GET /[slug]` | Terminal 4 |
| Painel | `/dashboard`, `/dashboard/services`, `/dashboard/customers`, `/dashboard/settings`; login único em `/login` (`/dashboard/login` redireciona) | mesmo app Next (antes Terminal 2) |
| Dados do painel | Server Components + Server Actions (`lib/dashboard/data.ts`, `app/(product)/dashboard/(owner)/actions.ts`) no mesmo app; reutiliza schema/migrations do backend | app único |

## Painel do dono — app único (veio de `feat/dashboard-v2`, consolidado em `feat/frontend-consolidation`)

Decisão do dono: um único app Next.js, sem backend separado. Em relação ao PR #1 (`feat/dashboard`):

- As rotas `app/api` de auth, public, webhooks e onboarding permanecem. A rota de chave Pix responde 410 e não grava.
- A sessão do dono é validada **no mesmo processo** via `getAuth().api.getSession` (Better Auth), sem chamada HTTP a outra origem.
- Leituras/gravações usam Drizzle com `findOwnedBusiness`; dono A não acessa dados do negócio B (páginas, actions e testes de isolamento).
- Login em `/login` (`requestMagicLink`, mesma origem) e logout via `authClient`. A conexão Mercado Pago do negócio fica em `/api/businesses/[businessId]/mercadopago`.
- Base atual: `feat/backend`. Quando o PR de integração do backend entrar no master, esta branch será rebaseada.

### Leituras e sessão

- `/dashboard`: agenda do dia ou semana (`businessId`, `date=YYYY-MM-DD`, `view=week`).
- `/dashboard/services`, `/dashboard/customers`, `/dashboard/settings`: serviços, clientes e funcionamento.
- `requireOwner()` usa Better Auth local; sem sessão redireciona para `/login` (login único do app).
- `ownerContext()` lista só negócios do dono; negócio alheio aparece como indisponível.

### Gravações

| Ação | Comportamento |
| --- | --- |
| `saveService` | Cria/atualiza serviço do negócio autorizado; Zod + centavos no servidor. |
| `saveHours` | Substitui horários em transação com lock do negócio. |

Queries de disponibilidade não revelam dados pessoais. A criação de reserva impede concorrência de horários no banco.
O webhook fake valida assinatura, registra entregas e confirma de forma idempotente.
O gateway real deverá implementar `PaymentProvider`; nenhuma cobrança bancária real ocorre nesta versão.

## Aplicação e reversão

Não existiam tabelas, leitores, escritores ou dados de aplicação antes desta migration. Os escritores são Better Auth, as rotas de reserva e o webhook autenticado.

Caminho adiante: iniciar Postgres com `pnpm db:up`, aplicar `pnpm db:migrate`, iniciar aplicação e executar `pnpm test:db`.
Repetir `db:migrate` não recria tabelas nem reaplica migrations registradas. Falhas SQL são observáveis e a migration usa transação.
Em mudanças futuras com versões simultâneas, adicionar campos compatíveis antes de mudar leitores/escritores; nenhuma contração destrutiva está autorizada nesta tarefa.

Reversão segura: voltar ao código anterior e parar os serviços com `pnpm db:down`, mantendo o volume e as tabelas.
Não há script automático de DROP ou remoção de volume. Após entrada de dados reais, fazer backup e definir reversão específica antes de alterar o schema.


# Fluxo de reserva e Pix simulado

## Regras desta etapa

O servidor é a autoridade sobre preço, sinal e duração; o cliente envia somente serviço, horário e dados mínimos.
A reserva com sinal vence em `BOOKING_HOLD_MINUTES` (padrão 30, faixa 28–43200). O horário só aparece se começar depois desse prazo. Sinal zero confirma sem criar pagamento. O `expiresAt` público é esse hold, igual na reserva e no Pix. O Mercado Pago recebe `date_of_expiration` = hold + 2 minutos, e esse valor precisa ter pelo menos 30 minutos. Hold abaixo de 28 responde `503` `booking_unavailable`.
Um negócio atende um cliente por vez. Intervalos são semiabertos: um horário pode começar exatamente quando o anterior termina.
Disponibilidade usa o fuso do negócio e o intervalo de funcionamento do dia. Inícios avançam pela duração do serviço desde a abertura.
Reservas pendentes vencidas não ocupam disponibilidade. Ao criar nova reserva, elas são marcadas como expiradas antes da disputa pelo horário.
Concorrência é protegida por lock transacional do negócio e restrição de exclusão no Postgres. Não há confirmação após liberar uma reserva vencida.

## Rotas públicas

- `GET /api/public/config`: `{ holdMinutes, pixRecipientDisplayName: null, requiresPayerCpf }` com `Cache-Control: public, max-age=300`. `holdMinutes` é `BOOKING_HOLD_MINUTES`.
- `GET /api/public/[slug]/services`: nome, fuso, `pixRecipientDisplayName` (nome do dono, ou o nome do negócio se o do dono estiver vazio) e serviços ativos com `id`, `name`, `durationMinutes`, `priceCents`, `depositCents`, `bookable` e `blockedReason`.
- `GET /api/public/[slug]/availability?serviceId=<uuid>&date=YYYY-MM-DD`: responde `{ timezone, slots: [{ startsAt, endsAt }], bookingsPaused }`. `dates` é opcional: até 7 datas civis `YYYY-MM-DD` separadas por vírgula (no máximo 80 caracteres), todas entre `date` e os 6 dias seguintes. `2030-13-01` e `2030-02-31` respondem `400 invalid_input`. Sem `dates`, ou com uma data só, a resposta continua sem o campo `days`. Com mais de uma data, inclui `days: [{ date, slots }]`. `slots` continua sendo os horários do parâmetro `date`. A ocupação é lida ao vivo e não entra em cache. Datas de horários são ISO 8601 UTC. Lista vazia significa fechado, passado ou sem vagas.
- `POST /api/public/[slug]/bookings`: exige header `Idempotency-Key` UUID v4 e JSON `{ serviceId, startsAt, customer: { name, phone } }`. Telefone em E.164. `customer.cpfCnpj` é opcional e só segue ao Mercado Pago com `MP_REQUIRES_PAYER_CPF=true` (a tela só mostra o campo nesse caso). Não entra em `customers`, nem no `request_hash`, nem no `sessionStorage`. O digest novo é sha256 do JSON sem o CPF; a comparação também aceita o digest antigo (JSON inteiro) da mesma chave, sem regravar esse digest. Responde `201` com `{ bookingId, status, startsAt, endsAt, expiresAt, accessToken, payment }`; repetição idêntica responde `200` (CPF diferente, com o resto igual, também é repetição). Mesma chave com outro corpo responde `409`.
- `GET /api/public/[slug]/bookings/[id]/payment`: exige `Authorization: Bearer <accessToken>`. Responde `{ bookingId, status, startsAt, endsAt, expiresAt, payment, policy }`. Não retorna nome, telefone, `accessToken` nem dados do dono. Token ausente ou malformado responde `404` `booking_not_found` sem banco. O hash do token é conferido antes de qualquer outra leitura da reserva. O caminho comum não abre transação, não pega o lock do negócio e não grava expiração. Se a reserva está `pending_payment` e `expiresAt <= now`, a resposta traz `status: expired`. Se a cobrança está `creating` ou `pending` e `expiresAt <= now`, `payment.status` vem `expired`. QR e copia-e-cola continuam `null` fora de cobrança `pending` vigente. Gravar `expired` continua na criação de reserva, no webhook e na reconciliação, que já escrevem sob o lock. Quando a cobrança local está `pending`, tem id no gateway e o hold ainda vale ou venceu há no máximo 5 minutos, o GET consulta o gateway no máximo uma vez a cada 20 s por pagamento (contador em `booking_rate_limits`, propósito `payment-gateway-poll:v1`; sem coluna nova). A chamada usa `PAYMENT_PROVIDER_TIMEOUT_MS`, fora de transação e fora do lock. Se o gateway responder pago, o efeito entra por `applyPaidEvent` (o mesmo do webhook e da reconciliação), com dedup por evento, numa transação curta. Timeout ou erro do gateway mantém HTTP 200 com o estado local. Fora dessa janela não há escrita nem lock.

`payment` é `null` com sinal zero; caso contrário contém `{ id, provider, externalId, amountCents, status, expiresAt, qrCodeDataUrl, copyPaste }`.
O token de acesso é derivado com HMAC e contexto próprio usando o segredo do servidor; só seu hash é armazenado. UUID da reserva não autoriza leitura.
A chave de idempotência permite recuperar a resposta com o mesmo corpo e deve ser tratada como credencial: gerar com `crypto.randomUUID()`, não registrar em analytics e não reutilizar em outro pedido.
Repetições não renovam vencimento nem criam segunda cobrança. Campos extras, preço fornecido pelo cliente e datas sem fuso são rejeitados.
Respostas de domínio usam `Cache-Control: no-store`.

Erros: `{ error: { code, message } }`, sem detalhes pessoais ou internos. `400` entrada inválida; `404` negócio/serviço/reserva inacessível; `409` horário ocupado, chave reutilizada ou `hold_capacity_reached`; `413` corpo acima de 16 KiB; `429` `rate_limited` ou `pending_hold_limit`; `503` pagamento ou agendamento indisponível; `500` falha interna. `429` e `hold_capacity_reached` trazem `Retry-After` em segundos.

### Limite de reservas pendentes

Reservas com sinal não pago e não vencido (`pending_payment` com `expiresAt` futuro) são limitadas por negócio, sob o lock transacional do negócio e após marcar vencidas, então a contagem é exata sob concorrência:

- por cliente (`BOOKING_MAX_PENDING_PER_CLIENT`, padrão 3): identidade da seção Antiabuso, guardada em `bookings.client_hash` como HMAC por negócio, nunca o IP. Sem identidade, este limite não se aplica; `429 pending_hold_limit`.
- por telefone (`BOOKING_MAX_PENDING_PER_PHONE`, padrão 2): `429 pending_hold_limit`.
- por negócio (`BOOKING_MAX_PENDING_PER_BUSINESS`, padrão 50): `409 hold_capacity_reached`.

`Retry-After` aponta o vencimento mais próximo entre as reservas que causaram o limite. Replay idempotente de reserva existente não é bloqueado; reservas confirmadas, vencidas e de sinal zero não contam.

## PaymentProvider e fake

`PaymentProvider.createPixCharge` recebe chave de idempotência, centavos e vencimento; retorna identificador externo, centavos, vencimento, QR Code e copia-e-cola.
O provider deve criar no máximo uma cobrança por chave e repetir a resposta após falhas transitórias. Valores retornados são validados antes de persistir.
`PaymentProvider.verifyWebhook` autentica o corpo bruto e normaliza o evento. O domínio não interpreta protocolo do gateway.
Somente fake existe nesta etapa. Exige `PAYMENT_PROVIDER=fake`, segredo `FAKE_WEBHOOK_SECRET` exclusivo com ao menos 32 caracteres e ambiente diferente de produção.
QR Code PNG codifica texto prefixado `FAKE-PIX-NOT-PAYABLE`, não é um Pix bancário. A dependência `qrcode` é necessária para gerar QR Code padrão, sem implementar algoritmo próprio.
A reserva e o pagamento `creating` (só idempotencyKey/valor/vencimento) ocorrem numa transação curta com lock do negócio; `createPixCharge` roda **fora** de qualquer transação com timeout (`PAYMENT_PROVIDER_TIMEOUT_MS`) e `reference` = id do pagamento. Uma segunda transação curta anexa QR/`externalId` e promove a `pending` somente se ainda `creating`. Falha/timeout → `503` retriável; replay retoma. `expirePending` também expira `creating`. Interface do provider inclui `getCharge`/`findChargeByReference`/`cancelCharge`; `verifyWebhook` pode ser async (pronto para Mercado Pago).

## Webhook

`POST /api/webhooks/payments/fake` recebe JSON estrito:

```json
{
  "eventId": "evento-unico-do-provider",
  "type": "payment.paid",
  "externalId": "fake_uuid-da-cobranca",
  "amountCents": 1000,
  "paidAt": "2026-10-02T15:00:00.000Z"
}
```

Headers: `X-Fake-Timestamp` em segundos Unix e `X-Fake-Signature` em hexadecimal minúsculo.
Assinatura: HMAC-SHA256 de `<timestamp>.<corpo bruto>`, usando `FAKE_WEBHOOK_SECRET`. Comparação constante; tolerância de relógio de cinco minutos.
Assinatura inválida ou vencida responde `401`. JSON ou evento inválido responde `400`. Não há rota pública de simulação de pagamento.

Provedor, tamanho (Content-Length e leitura limitada a 16 KiB), assinatura e formato são verificados antes de qualquer acesso ao banco: provedor desconhecido `404`, corpo grande `413`, assinatura inválida `401`, evento inválido `400`, sem nenhuma escrita. Somente entregas verificadas geram linha em `webhook_deliveries`, única por `(provider, event_id)` e gravada na mesma transação do processamento: replay é no-op (responde `duplicate` sem novas linhas) e falha de processamento reverte tudo (`503`, o provedor reenvia). Guarda provider, identificador, hash do corpo, resultado e motivo; nunca guarda assinatura ou corpo bruto. A migration 0007 move entregas antigas não verificadas ou duplicadas para `webhook_deliveries_legacy` (arquivo de auditoria, sem exclusão). Rejeições não auditadas no banco devem ser observadas por logs/métricas do proxy.
Migration 0007 não é puramente expansiva: torna `event_id`/`body_hash` obrigatórios e únicos em `webhook_deliveries`, que o código anterior não respeita (gravava antes de validar). Aplicar junto com este código. Reversão: voltar ao código anterior e executar `ALTER TABLE webhook_deliveries DROP CONSTRAINT webhook_deliveries_provider_event_unique, ALTER COLUMN event_id DROP NOT NULL, ALTER COLUMN body_hash DROP NOT NULL;` As colunas/índices novos de `bookings` e a tabela legacy podem permanecer; nunca apagar `webhook_deliveries_legacy`, reservas ou pagamentos ao reverter.
`payment_events` tem identidade única por provider e evento, hash do evento normalizado, identificador da cobrança e resultado. Evento já visto com mesmo conteúdo é duplicado; conteúdo diferente com mesmo identificador responde `409`.
Deduplicação, alteração do pagamento, confirmação da reserva e resultado do evento ocorrem na mesma transação.
O efeito de pagamento confirmado vive em `applyPaidEvent` (webhook, GET da reserva e reconciliação). "No prazo" é `date_approved` (`PaidEvent.paidAt`, `paidAtSource: "date_approved"`) comparado com o hold mais 2 minutos (`PIX_APPROVAL_TOLERANCE_MS`). A hora do processamento não decide. Sem `date_approved` válido, `paidAtSource` é `fallback`: confirma só com o hold ainda aberto; depois do hold vale a política de atraso. Aprovação no prazo com reserva já expirada retoma o horário se estiver livre (`on_time_reclaimed`, savepoint no 23P01). A política padrão `refund` devolve todo Pix pago depois do prazo da reserva (`late_no_slot`, causa `window_expired`), mesmo com o horário livre. Não há tela para o dono mudar isso. `rebook_if_free` confirma se o horário ainda estiver livre e no futuro (`late_rebooked`, savepoint no 23P01). Se o horário estiver ocupado, o update roda num savepoint: o `23P01` não aborta a transação e a devolução segue (`late_no_slot`, causa `slot_taken`). Depois do commit, fora de qualquer lock, o webhook e o GET estornam na hora com `PAYMENT_PROVIDER_TIMEOUT_MS` e a chave `auto_late:{paymentId}`. O e-mail usa a causa gravada na auditoria (`window_expired` ou `slot_taken`). Timeout ou falha do gateway não vira erro da resposta: a tentativa fica `requested` e o reconciliador retoma a mesma chave, sem segunda devolução. Recusa definitiva grava `refundStatus` `failed`. A rota `GET/POST /api/businesses/[businessId]/bookings/[bookingId]/refund` existe para a devolução pedida pelo dono; a tela não oferece essa devolução. A devolução manual que o dono faz é no app do Mercado Pago. A listagem (`dashboardBookings`) e o detalhe (`dashboardBookingDetail`) expõem `refundStatus` (`null | in_process | refunded | failed`), `refundedAt` (ISO-8601 ou null), `manualRefundDueAt` (ISO-8601 ou null), `manualRefundOverdue` e `manualRefundDueTomorrow`, separados do status da reserva. O prazo é o fim do 7º dia corrido no fuso do negócio (`MANUAL_REFUND_DEADLINE_DAYS` = 7). O lembrete da véspera sai na primeira passagem do reconciliador nesse dia local. O dia de origem é o aviso da falha automática ou de `unverifiable_seller_disconnected`, ou, na devolução pela política, `payments.policy_refund_requested_on`. Vencer não estorna, não cobra e não cancela. A data gravada permanece para auditoria.

`GET /api/businesses/[businessId]/bookings/[bookingId]/refund` é a prévia do diálogo, na mesma rota do POST, com sessão do dono. Responde `200` com `{ eligible, reason, amountCents, customer: { name, emailMasked }, policy: { text, refundDeadlineAt }, paidAt, requestedOn, todayLocal, paidOnLocal, manualRefundDueAt }` e `Cache-Control: no-store`. `requestedOn`, `todayLocal` e `paidOnLocal` são `YYYY-MM-DD` no fuso do negócio; `requestedOn` e `paidOnLocal` podem ser null. `reason` é `null` ou `not_paid | already_refunded | refund_in_process | refund_window_expired | mp_account_not_connected`. O prazo de 180 dias conta da aprovação. `policy` lê o snapshot da reserva se as colunas existirem; senão vem null.

`POST` recebe `{ confirm: true, expectedAmountCents, requestedOn? }`. O cliente não manda chave. O servidor trava a linha do pagamento (`SELECT … FOR UPDATE`) só para gravar `payment_refunds` e a data do pedido, e solta o lock antes de chamar o Mercado Pago. Índice único parcial em `payment_refunds(payment_id) WHERE status IN ('requested','processing','refunded')`: no máximo uma tentativa ativa. `idempotency_key` nasce no servidor, `{paymentId}:{n}`, e segue como `X-Idempotency-Key`. POST repetido com devolução `processing` ou `refunded` responde `200 { status: "in_process" | "refunded", refundId }` e não chama o Mercado Pago de novo. `status: processing` da tabela aparece como `in_process` na resposta. Data inválida responde `422` com `refund_requested_on_invalid`, `refund_requested_on_in_future` ou `refund_requested_on_before_payment`. A primeira chamada válida grava `policy_refund_requested_on` e, se ainda não houver prazo, `manual_refund_due_at`, mesmo quando o Mercado Pago recusa por falta de saldo. "Tentar de novo" depois de uma recusa ignora `requestedOn` e usa outra chave. Timeout (`503 refund_unavailable`) reaproveita a mesma chave e não marca `failed`. Valor divergente ou pedido inelegível responde `409` antes de gravar a data. `502 refund_failed` quando o gateway recusa. Não há devolução automática nesse caminho.

O lembrete da véspera (E5) sai só para o dono, na primeira passagem do reconciliador durante o dia local anterior ao prazo. Com o cron `0 6 * * *` UTC isso é cerca de 03:00 em America/Sao_Paulo (o Hobby pode atrasar até 59 min, ainda dentro dessa hora). Um cron a cada poucos minutos manda logo após a meia-noite local. `manual_refund_reminder_sent_at` e o `UPDATE … RETURNING` garantem um único envio. Os lembretes de D+1 e D+2 seguem a mesma regra: a primeira passagem daquele dia local, no máximo um por dia. Se a primeira tentativa da devolução pela política cai no D+6 ou depois, o E5 não sai. `owner_notices` usa o desenho do PR de OAuth: `booking_id` nulo, `dismissed_at` obrigatório (default `now()`), sem chave primária. Índices únicos parciais `owner_notices_business_kind_uq` em `(business_id, kind) WHERE booking_id IS NULL` e `owner_notices_booking_kind_uq` em `(booking_id, kind) WHERE booking_id IS NOT NULL`. Não há unique em `(business_id, booking_id, kind)`. Esta entrega só acrescenta `email_sent_at`. A linha `refund_deadline_eve` preenche `booking_id`. A migration 0012 usa `CREATE TABLE IF NOT EXISTS` e `CREATE UNIQUE INDEX IF NOT EXISTS`. A contagem do lembrete diário (no máximo 2, em D+1 e D+2) sai de `email_sent_at`, sem coluna extra.

Reconciliador (`pnpm reconcile` e `GET/POST /api/cron/reconcile`): retoma `creating` preso (`RECONCILE_STUCK_SECONDS`), cancela no gateway `pending`/`expired` com `externalId` e `remote_cancelled_at` nulo, consulta `pending` com `expiresAt` ainda no futuro (dentro do hold) por webhooks perdidos, retoma a devolução `late_no_slot` que o webhook ou o GET não concluiu (mesma chave `auto_late:{paymentId}`) e promove `in_process`. Falha de um pagamento (timeout, 5xx, conta Mercado Pago desconectada) incrementa `failures` e segue para os outros pagamentos e para as etapas seguintes (cancelar vencidos, polling, estornos, lembretes). O log leva só `stage`, id do pagamento e um código estável (`reconcileFailureCode`); não leva mensagem do gateway, e-mail, telefone nem token. Cobrança cujo cancelamento remoto já terminou grava `payments.remote_cancelled_at` e sai da fila. Tentativa que não terminou grava `remote_cancel_attempted_at`; a fila ordena esse campo com null primeiro, depois `expires_at`. A passagem para ao estourar `RECONCILE_BUDGET_MS` (padrão 50000, abaixo do `maxDuration` de 60s da rota) e devolve o restante em `deferred` / `stagesSkipped`. Sem token (`mp_account_not_connected`), `creating` vencido expira no local e não segura a passagem. Chamadas ao gateway ficam fora do lock do negócio. Advisory lock de sessão evita trabalho duplicado. Auditoria em `payment_audit` (sem PII). Falha ao apagar rascunhos de onboarding vencidos não impede a reconciliação: a resposta traz `draftCleanupFailed: true` e o relatório da passagem. Migration `0017_payment_remote_cancel`.

Migrations 0008 (ADD VALUE do enum, commit isolado) e 0009 (tabela `payment_audit`, `late_payment_policy`, checks de `creating`/`pending`, unique `(business_id,id)` em payments). Reversão 0009: dropar checks/índices/`payment_audit`/`late_payment_policy` e o unique novo; valores de enum (`creating`,`cancelled`,`refund_pending`) são irreversíveis no Postgres — o código antigo simplesmente não os grava. Nunca apagar pagamentos/reservas/audit ao reverter.

Somente cobrança identificada pelo provider e identificador externo pode ser alterada. Valor deve corresponder à cobrança e ao sinal contratado.
Pagamento válido recebido a tempo confirma somente reserva pendente ainda válida. Pagamento tardio registra o dinheiro. Com horário livre, ainda no futuro, e `rebook_if_free`, vira `late_rebooked`. Com `refund` (padrão), ou com `rebook_if_free` sem horário disponível, o webhook, o GET e o reconciliador estornam fora da transação, com a mesma chave. A causa do e-mail sai da auditoria (`window_expired` ou `slot_taken`). Nenhum outro caminho chama o estorno. Não há repasse neste fluxo.
Evento de valor divergente é `rejected`, sem alterar cobrança ou reserva. Pagamento já pago é `duplicate`. Cobrança desconhecida é `ignored`.
Eventos autenticados processados respondem `200` com `{ outcome, reason }`, permitindo ao provider parar tentativas sem repetir efeitos.
Falha de infraestrutura responde `503` e mantém entrega marcada como falha quando o banco estiver acessível; o provider deve tentar novamente. Sem banco disponível não é possível persistir auditoria.

## Migration e compatibilidade

Campos novos em reservas e cobranças são opcionais no banco para preservar dados e testes antigos; endpoints novos só criam registros completos.
Tabelas de eventos são aditivas. A extensão `btree_gist` e a exclusão de horários entram em migration separada. Ela falha atomicamente se houver horários ativos sobrepostos; nenhum registro é removido ou alterado silenciosamente.
Aplicar migrations antes do novo código. Reversão: voltar ao código anterior, preservando campos, tabelas e volume. Não executar contração ou DROP automático.


A chave enviada ao provider é derivada da identidade do negócio e da chave do pedido, em formato UUID. Assim, a mesma chave pública usada em negócios diferentes não cruza cobranças.
O endpoint público não altera o nome de um cliente já cadastrado ao encontrar o mesmo telefone; atualização de cadastro fica a cargo do painel autenticado.
QR Code e copia-e-cola são retornados somente enquanto a cobrança está pendente e válida; tornam-se `null` após vencimento ou pagamento.


## Dados de demonstração

Execute `pnpm db:seed` após `pnpm db:up` e `pnpm db:migrate`. O comando usa o driver Postgres já instalado, sem nova dependência.
O seed é transacional e idempotente: repetir não duplica dono, negócio, serviços ou horários. Execuções simultâneas são serializadas.
Não redefine cadastros já existentes, não troca o dono de um slug ocupado e não cria reservas ou pagamentos. Fica bloqueado em produção.

- Negócio: **Barbearia Demo**.
- Slug: **`barbearia-demo`**. API de serviços: `/api/public/barbearia-demo/services`; página prevista: `/barbearia-demo`.
- Dono de teste: **`dono-demo@example.com`**.
- Login: **link mágico, sem senha**. Configure SMTP de testes para capturar o email e solicite `POST /api/auth/sign-in/magic-link` com `{ "email": "dono-demo@example.com", "callbackURL": "/" }`. Abra o link recebido. O domínio `example.com` é fictício; não há caixa de email real nem senha padrão.
- Funcionamento: segunda a sábado, **09:00–18:00**, no fuso **America/Sao_Paulo**. Domingo fechado.

| Serviço fictício | Duração | Preço em centavos | Sinal em centavos |
| --- | --- | --- | --- |
| Corte | 30 minutos | 3500 | 1000 |
| Barba | 30 minutos | 2500 | 500 |
| Corte e barba | 60 minutos | 5500 | 1500 |

Preços e horários acima são dados de teste, não uma definição comercial do produto.

## B02 — autoridade auth/Pix e origens locais

Autoridade: http://localhost:3000. Em desenvolvimento, origem exata permitida: localhost na porta3000 (app único). Usar localhost, nunca alternar com127.0.0.1. Em produção somente origem de BETTER_AUTH_URL; portas locais não são automaticamente confiáveis. Cookies Better Auth permanecem HttpOnly, SameSite=Lax e host-only (sem Domain; Secure em HTTPS). Browser deve usar credentials: include; Server Components encaminham Cookie somente à autoridade fixa. Callbacks absolutos das origens permitidas aceitos pela biblioteca.

GET/POST auth recebem CORS credenciado somente para origem exata permitida. A rota pix-key não grava mais: qualquer método responde 410 `pix_key_retired`. OPTIONS de auth valida origem, método e headers solicitados; devolve204 com Allow-Origin específico, Allow-Credentials:true, Allow-Methods e Allow-Headers(Content-Type,Authorization). Origem externa/método/header alheio responde403 sem Allow-Origin. Respostas têm Vary:Origin e no-store. CORS não substitui sessão, tenant, CSRF ou cifragem. Chamadas server-side GET sem Origin permanecem permitidas.

Fixture B02: `NODE_ENV=development node scripts/create_backend_fixture.mjs /caminho/privado/fixture.json`. Exige banco local, autoridade localhost3000 e segredo Pix válido; cria somente usuário/negócio/serviço/horários sintéticos e sessão de1h. Arquivo0600 exclusivo contém Cookie/IDs, nunca versionar nem copiar para frontend/logs. Prova sessão/tenant/Pix; não valida link mágico nem entrega SMTP. Cookie do servidor continua sem Domain, sem tornar endpoint público de bypass. Fixture operacional disponível nesta máquina em `/tmp/agenda-backend-b02-fixture.json`; expira em1h.

## F01 — contrato de provisionamento pós-auth (implementado no backend)

Origem de produção única: `BETTER_AUTH_URL` define a origem canônica (protocolo, host e porta). Em produção não são adicionadas portas de desenvolvimento nem domínios de consumidores. O app final deve publicar interface e autoridade nessa mesma origem; :3000 permanece a única autoridade local. Não usar wildcard nem abrir origens extras para contornar a integração.

Migration 0006 é expansiva: adiciona somente `onboarding_requests`, preservando tabelas e dados existentes. Aplicar antes de habilitar POST onboarding. Reversão operacional: voltar ao código anterior e manter a tabela/registro de migration; o código anterior não a utiliza. Não apagar a tabela nem suas chaves/resultados no rollback. Remoção posterior exige tarefa própria de retenção de dados. Prova isolada: `node scripts/verify_onboarding.mjs` aplica migrations duas vezes, testa concorrência/replay/isolamento e remove somente o banco temporário criado pelo próprio script.

Implementado por T1; consumo T5 após aplicar migration 0006 na autoridade. `POST /api/onboarding`, JSON estrito `{business:{name,slug,timezone?},service:{name,durationMinutes,priceCents,depositCents},hours:[{weekday,opensAt,closesAt}]}`. Nome do negócio e serviço com trim,1..120 caracteres; slug1..100 caracteres no padrão /^[a-z0-9]+(-[a-z0-9]+)*$/, rejeitando reservados (login, onboarding, preview, dashboard, api, admin, auth, health, ready, webhooks, _next, static, favicon.ico; case-insensitive); serviço conforme lib/validation/service.ts (inteiros até2147483647); timezone IANA válido, default existente America/Sao_Paulo se omitido; hours com1..7 dias, weekday inteiro0..6 sem duplicatas; horas HH:mm, abertura<fechamento, somente dias escolhidos. Dinheiro em inteiros centavos, preço>=0 e0<=sinal<=preço; duração inteira positiva. Não enviar ownerId, businessId, status, trialEndsAt ou plano; rejeitar campos extras.

Exige sessão Better Auth validada pela autoridade, Origin permitido e `Idempotency-Key` UUIDv4. Derivar ownerId da sessão, nunca do formulário. Criar negócio, primeiro serviço e horários em uma transação: ou todos persistem, ou nenhum. Não criar cobrança/assinatura/chave Pix neste endpoint. Trial/assinatura são contrato separado; não assumir ativação apenas por cadastro.

Primeiro pedido responde201 `{businessId,slug,publicPath,serviceId}` (publicPath=`/[slug]`); replay idêntico por mesmo owner+chave responde200 com o mesmo resultado; mesma chave/corpo diferente409 `idempotency_conflict`; slug indisponível409 `slug_unavailable`. Nenhum replay de outro dono lê tenant alheio. O contrato não impõe limite inventado de negócios por dono. Persistir chave/hash/resultado vinculado ao dono para replay; migration 0006 cria onboarding_requests com chave composta ownerId/requestKey e resultado transacional.

Erros padrão `{error:{code,message}}`:400 entrada,401 sem sessão,403 origem,409 conflito,413 corpo>16KiB,503 infraestrutura; no-store. GET/PUT/DELETE não definidos. Após201/200, T5 exibe link real e pode encaminhar para http://localhost:3000/dashboard (mesmo host da autoridade); não duplicar login/UI nem simular sucesso fora de Preview. Testes cobrem conflito slug com rollback do pedido, replay concorrente e isolamento de dois donos. CORS das APIs públicas e onboarding permite somente as origens locais já contratadas; preflight aceita Idempotency-Key. Nenhum consumidor deve remover APIs locais antes da prova autenticada.

## Antiabuso de reservas

`GET /api/public/[slug]/bookings/[id]/payment` tem baldes próprios (`payment-poll:v1`), separados da criação de reserva, na mesma tabela de contadores. A página consulta a cada 4 s (15/min). Por cliente `PAYMENT_POLL_RATE_LIMIT_PER_CLIENT` (padrão 120) e teto do negócio `PAYMENT_POLL_RATE_LIMIT_PER_BUSINESS` (padrão 2400), janela de 1 minuto. O padrão por cliente cabe a cadência de 4 s, outra aba e o botão de verificar; o do negócio cabe os 50 sinais pendentes (50×15 = 750) com folga. O balde do cliente é consumido primeiro. Excesso: `429` `rate_limited`, `Retry-After: 60`, corpo `{ error: { code, message } }`. Sem IP confiável, só o teto do negócio se aplica. A consulta ao gateway não usa esse balde: o intervalo de 20 s é outro contador (`payment-gateway-poll:v1`) e não altera o 429.

POST reservas mantém corpo/chave e respostas201/200/409. Dois baldes por minuto, contador atômico PostgreSQL (compartilhado por processos): por par negócio+cliente (`BOOKING_RATE_LIMIT_PER_CLIENT`, padrão10) e teto do negócio (`BOOKING_RATE_LIMIT_PER_BUSINESS`, padrão120). O balde do cliente é consumido primeiro; tentativas recusadas nele não consomem o teto do negócio, então um cliente sozinho usa no máximo o seu limite. Excesso429 `rate_limited`, Retry-After:60; reenvio com mesma Idempotency-Key preserva idempotência de negócio e não renova reserva, mas também consome o limite de tentativas. Não recriar pedido com nova chave por erro transitório.

Identidade do cliente: com `BOOKING_TRUST_PROXY=true`, `BOOKING_CLIENT_IP_HEADER=x-real-ip` (padrão) usa X-Real-IP válido; `x-forwarded-for` usa a regra rightmost-trusted, o item na posição `BOOKING_TRUSTED_PROXY_HOPS` (padrão1) a partir da direita. Usar apenas quando o proxy de entrada sobrescreve/anexa esse header e impede acesso direto ao Next. Sem proxy confiável, usa o último item de X-Forwarded-For, que o Next preenche com o endereço do socket quando ausente; um cliente pode forjá-lo, mas só se divide em baldes próprios (o teto do negócio limita o total) e não esgota o balde de outros. IPv6 é agrupado por /64; IPv4 mapeado é normalizado. Header ausente/inválido resulta em identidade nula: só o teto do negócio se aplica, nunca um balde anônimo compartilhado de10. Configuração inválida responde `503 booking_unavailable`. Endereço não é armazenado: HMAC com segredo do servidor, combinado ao tenant. Registros obsoletos>24h são removidos oportunisticamente em lotes100; não há corpo/telefone/IP bruto.

Migration aditiva cria apenas contadores, preservando schema/dados existentes. Aplicar antes do novo código; processos antigos continuam compatíveis mas sem limite até atualização. Reversão preferida: voltar ao commit anterior e manter tabela aditiva; remoção da tabela só depois de nenhum novo leitor/escritor ativo, com aprovação operacional. Nunca remover reservas/pagamentos ao reverter.

## Readiness

`GET /api/health` permanece liveness200. `GET /api/ready` (novo):200 `{status:"ready"}` se SELECT1 PostgreSQL e autenticação/conexão SMTP passam;503 `{status:"unavailable"}` em qualquer falha. Sem autenticação, no-store, sem nomes de servidores, credenciais, erros brutos ou PII. Não envia e-mail, não cria cobrança, não testa domínio/remetente ou entrega do destinatário; pagamento bancário continua gate separado.

## Onboarding v2 — rascunho, link e código (draft)

`POST /api/onboarding` (F01) não muda e não limita quantos negócios um dono cria. A flag `ONE_BUSINESS_PER_OWNER` só vale no commit do rascunho. Ausente ou diferente de `true` mantém vários negócios. `true` faz o commit responder `409 already_has_business` com `{ publicPath }` do negócio mais antigo, salvo replay do mesmo rascunho (200).

Migration `0016_onboarding_drafts` adiciona `onboarding_drafts` e `abuse_rate_limits`. Na branch de integração ela fica por último, com `when` maior que o da `0015`. Reversão: voltar o código e manter as tabelas. Não apagar rascunhos no rollback.

`POST /api/onboarding/drafts` exige Origin, corpo `{ email, segment, plan, data }` e devolve `201 { draftId, expiresAt }` com `Set-Cookie: onb_draft=<uuidv4>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`. `plan` é `base` ou `completo`. Em `NODE_ENV=production`, `completo` responde `400` `{ "error": { "code": "plan_unavailable" } }` e não grava o rascunho. Fora de produção, `completo` continua aceito. A visita com `?plano=base`, e qualquer visita em produção, envia `base` mesmo que o aparelho ainda tenha `completo` guardado. Um `400` de validação ou de plano mostra a mensagem desse erro, não o aviso genérico de falha interna. `data` passa por `onboardingInputSchema` depois de `normalizeSlug(slug, { final: true })`. Horário aceita `HH:mm` ou `HH:mm:ss` (o campo de hora do celular) e grava `HH:mm`. Slug com menos de 3 caracteres: `400 invalid_input`. Reservado continua `400`. Tomado: `409 slug_unavailable` com `suggestions`. 10 criações por IP por hora: `429 rate_limited` e `Retry-After`. Sem IP confiável, a criação não entra num balde compartilhado.

`GET /api/onboarding/drafts/:id` → `200 { draftId, email mascarado, segment, plan, data, expiresAt }` se o cookie `onb_draft` é o id ou a sessão tem o mesmo e-mail. Senão `404`, mesmo vencido. Vencido e autorizado: `410 draft_expired`.

`PATCH` aceita `{ email? , data? }` com ao menos um campo. `200` no mesmo formato do GET. Trocar o e-mail apaga códigos `sign-in-otp-<email>` anteriores. Rascunho já consumido: `409 draft_consumed`.

`POST /api/onboarding/drafts/:id/commit` exige sessão e o mesmo e-mail. Em `NODE_ENV=production`, rascunho com `plan` `completo` responde `400 plan_unavailable` antes de criar o negócio; o replay de um commit que já deu certo continua `200`. Chama `provisionBusiness(userId, draftId, data)`. Primeira vez `201`; repetição `200` com o mesmo `{ businessId, slug, publicPath, serviceId }`, inclusive se o rascunho já venceu depois do sucesso. `401` sem sessão. Id que não é UUID v4: `400`. E-mail diferente: `404`.

`GET /api/public/slugs/availability?slug=` → `200 { input, normalized, valid, available, reason, suggestions }` com `Cache-Control: no-store`. `reason`: `null | too_short | invalid | reserved | taken`. Sugestões só quando reservado ou tomado, no máximo 3, numa query `IN` (equivalente ao `ANY` da spec). `segment` e `uf` são opcionais; segmento fora da lista e UF que não tem 2 letras são ignorados. 30 consultas por IP por minuto.

Código: plugin `emailOTP` (`otpLength: 6`, `expiresIn: 1800`, `allowedAttempts: 3`, `storeOTP: "hashed"`, `resendStrategy: "rotate"`). `POST /api/auth/email-otp/send-verification-otp` com `{ email, type: "sign-in" }` e `POST /api/auth/sign-in/email-otp` com `{ email, otp }`. O e-mail traz o código agrupado e o botão `https://{app}/onboarding/confirmar?d={draftId}#c={código}` (sem `d` se não houver rascunho ativo). 5 envios por e-mail por hora e 20 por IP por hora na tabela `abuse_rate_limits`. O `rateLimit` do plugin fica em 30 por 60 s porque o mesmo número vale também para conferir o código. Reenvio gera código novo e invalida o anterior. Três códigos errados bloqueiam o quarto, mesmo correto.

Link mágico: `expiresIn: 1800`. O e-mail abre `GET /entrar/confirmar?token=…`, que não consome o acesso. O botão faz POST na página; o servidor chama o verify oficial (GET no plugin 1.7.7) e copia o cookie de sessão. Copy: vale por 30 minutos.

`lib/slug.ts` neste branch é provisório. A lista `RESERVED_BUSINESS_SLUGS` não foi ampliada aqui. `contactWhatsapp` e `depositPolicy` entram no contrato de política do sinal, logo abaixo.

## Política do sinal, teste grátis e WhatsApp

Erros deste fluxo usam `{ error: { code, message, ... } }`. `409 policy_changed` inclui `depositPolicy`, `policySummary` e `policyHash` dentro de `error`. `403 bookings_paused` traz só `code` e `message`.

`services.deposit_policy` é jsonb obrigatório, padrão Padrão (janela de 24 h para devolução e remarcação; atraso e falta ficam com o negócio). A devolução pela política não é automática: o dono devolve pelo app do Mercado Pago, e o valor sai da conta Mercado Pago dele. Essa frase fica só na prévia do dono (`ownerPreview`). A reserva com sinal guarda `policy_snapshot`, `policy_text`, `policy_hash`, `refund_deadline_at` e `reschedule_deadline_at` na mesma transação. Sinal zero deixa esses campos nulos. `policy.text` (criação e consulta da reserva) é o texto do cliente: comprovante (`policyIcsText`) e os detalhes (`policyDetails`), calculado com `bookings.created_at` (`bookedAt`), não com o relógio da consulta. O nome do campo continua `text`. Ao lado fica `policy.refundWindowClosedAtBooking`: verdadeiro quando a reserva foi criada em cima ou depois do prazo de devolução. Nesse caso o texto não traz data de devolução. `policyHash` continua sendo o hash da prévia do dono, estável por negócio e serviço. `POST /api/public/[slug]/bookings` exige `policyHash` quando o sinal é maior que zero. Hash diferente do texto atual responde `409 policy_changed`.

`GET /api/public/[slug]/services` devolve `address` e `phone` (`null`), `logoUrl` (coluna `businesses.logo_url`), `contactWhatsapp`, `bookingsPaused`, `requiresPayerCpf` (env `MP_REQUIRES_PAYER_CPF`, padrão `false`), `pixRecipientDisplayName` (nome do dono, ou o nome do negócio se o do dono estiver vazio) e, em cada serviço, `bookable` e `blockedReason`. O catálogo (serviços, perfil e horários de funcionamento) pode ficar até 30 segundos no cache do servidor e é invalidado na hora em que o dono muda serviço, horário, WhatsApp, nome, slug (tags do slug antigo e do novo), logo, a conexão Mercado Pago (refresh que grava token ou `needs_reconnect`, e desautorização) ou a assinatura dentro do Next. A linha de assinatura é lida ao vivo em toda resposta cacheada: o CLI `billing:activate` roda fora do Next e o `revalidateTag` de lá não dispara. A resposta HTTP continua `Cache-Control: no-store`. A regra de teste grátis, consentimento e conta conectada é calculada na leitura, com o relógio da requisição. Com sinal, também `depositPolicy`, `policySummary` e `policyHash`. Sem sinal, esses três campos são `null`. `blockedReason` é `bookings_paused` quando o teste acabou. Com sinal e conta que não está `connected`, é `mp_account_not_connected`. Com conta `connected` e consentimento diferente de `2026-10-09.v4`, ou sem data de aceite, é `mp_consent_outdated`. Com `NODE_ENV` e `MERCADOPAGO_ENV` em `production` e `live_mode` false, é `mp_account_test_mode`. Serviço sem sinal não fica bloqueado por esses motivos. Sandbox e desenvolvimento não bloqueiam `live_mode` false. A página pública trata conta desconectada, consentimento desatualizado e conta de teste como serviço indisponível e não mostra o texto do dono.

`GET /api/public/[slug]/availability` inclui `bookingsPaused`. Com a agenda pausada, `slots` vem vazio. A consulta da reserva e a criação respondem `policy: { text, snapshot, refundDeadlineAt, rescheduleDeadlineAt, refundWindowClosedAtBooking }` ou `null`. Na confirmação, no comprovante, na página da reserva e no arquivo de calendário, o front lê `policy.text`. Não há e-mail de reserva ao cliente.

`businesses.trial_ends_at` é obrigatório. Negócio novo termina às 23:59:59 do 7º dia local. Negócio já existente recebe `now() + interval '7 days'` na migration `0011`. `subscriptions` guarda status `trialing | active | past_due | canceled` e `provider` (`manual` | `pix_platform`, ou nulo enquanto ninguém ativou). `GET /api/businesses/{businessId}/billing` exige sessão do dono e responde `{ state, trialEndsAt, daysLeft, bookingsPaused, plan: { name: "AgendaPix", priceCents: 4900 }, subscription, checkout }`. `state` é `trial`, `trial_ending`, `trial_last_day`, `paused` ou `active`. O objeto `checkout` está na seção da assinatura manual.

Agenda pausada: `createBooking` responde `403 bookings_paused` antes do limite de tentativas. Replay da mesma `Idempotency-Key` não é bloqueado. Pix já gerado ainda confirma. Disponibilidade pública fica vazia com `bookingsPaused: true`.

`getDepositBookability` em `lib/bookings/deposit-bookability.ts` continua retornando ok. A conta Mercado Pago entra por `assertMpConnectedForDeposit` e `getServiceBlockedReason`: serviço com sinal, sem conexão, responde `409` `mp_account_not_connected` e a listagem marca `bookable: false`. Conta `connected` cujo `consent_version` não é `2026-10-09.v4`, ou sem `auto_refund_ack_at`, responde `409` `mp_consent_outdated` com a mensagem "Aceite o texto novo da devolução automática para voltar a receber sinal." e a listagem marca `bookable: false`. Com `NODE_ENV=production` e `MERCADOPAGO_ENV=production`, conta conectada com `live_mode` false responde `409` `mp_account_test_mode` e a listagem marca `bookable: false` com esse `blockedReason`. Fora disso, `live_mode` false só aparece como aviso na tela. Essa checagem só vale para reserva nova e para ativar serviço com sinal. Repetir a mesma chave de idempotência, confirmar Pix já gerado e devolver não passam por ela. Não há checagem de chave Pix.

A listagem do dono (`dashboardServices`) inclui em cada serviço `bookable` e `blockedReason`. Hoje: `bookable: true` e `blockedReason: null`, ou `bookable: false` e `blockedReason: "bookings_paused"` quando o teste acabou sem assinatura ativa. Serviço sem sinal não herda um bloqueio futuro de conta Mercado Pago. `GET /api/businesses/{businessId}/services/{serviceId}/future-bookings-count` responde `{ count }` de reservas confirmadas com início futuro.

`businesses.contact_whatsapp` é opcional, E.164. Entra no onboarding, em Ajustes e em `contactWhatsapp` no payload público.

## Mercado Pago OAuth por negócio

O Pix do sinal cai na conta Mercado Pago do próprio negócio. A plataforma não faz split nem repasse. Tokens ficam cifrados com `MP_TOKEN_ENCRYPTION_KEY` (AES-256-GCM, pacote `v1.nonce.ciphertext`). Nunca saem em resposta, log ou status.

`MP_OAUTH_PKCE` aceita `on` ou `off`. Ausente vale `off`. String vazia ou qualquer outro valor, no boot e ao usar a conexão, responde `503` `{ "error": { "code": "mp_oauth_pkce_invalid", "message": "MP_OAUTH_PKCE deve ser on ou off." } }`. Com `MERCADOPAGO_ENV=production`, fora do `next build`, o boot (`assertProductionSafeEnv`, já chamado em `instrumentation.ts`) recusa subir se o valor não for `on`. A mensagem é `MP_OAUTH_PKCE deve ser on quando MERCADOPAGO_ENV=production.` e não repete o valor. Com `NODE_ENV=production`, fora do `next build`, o mesmo boot valida `bookingConfig`: variável de reserva inválida derruba o processo na hora. A mensagem cita o nome da env (por exemplo `BOOKING_HOLD_MINUTES`) e não o valor. Fora de produção o boot não chama `bookingConfig`; a primeira reserva ainda recusa o valor inválido. O `next build` com `VERCEL_ENV=production` chama `assertVercelProductionBuild` em `next.config.ts` e falha se `MP_OAUTH_PKCE` não for `on` (mesma leitura de ` on `) ou se `bookingConfig` for inválido, para a Vercel recusar o deploy. `VERCEL_ENV=preview` e o desenvolvimento não entram na checagem de PKCE nem de `bookingConfig`. O `next build` com `VERCEL_ENV=preview` entra na de `BOOKING_ACCESS_SECRET` (vazio, curto, igual a `BETTER_AUTH_SECRET` ou prefixo de exemplo). Production e Preview usam valores diferentes. Nunca grave a variável vazia. `on` envia `code_challenge` e `code_challenge_method=S256` na autorização e `code_verifier` no token. `off` não envia esses campos. O cookie httpOnly grava `pkce` daquela tentativa; o callback segue o cookie, não a env do momento. `verifier` só existe no cookie com `pkce: true` (43–128 caracteres). `state` anti-CSRF vai nos dois modos. A autorização padrão é `https://auth.mercadopago.com/authorization`. `MP_OAUTH_AUTHORIZE_URL` sobrescreve esse host. O token continua em `POST https://api.mercadopago.com/oauth/token`. O app precisa da URL de redirecionamento `https://www.agendapix.dev.br/api/integrations/mercadopago/callback`. PKCE só deve ser ligado se o toggle "Usar o fluxo de código de autorização com o PKCE" existir e estiver habilitado, em Detalhes da aplicação → Editar dados → Configurações avançadas. O que o Mercado Pago faz se receber os campos de PKCE com o fluxo desligado não está documentado.

| Método e rota | Comportamento |
| --- | --- |
| `POST /api/businesses/{id}/mercadopago/connect` | Dono autenticado. Corpo `application/x-www-form-urlencoded` ou JSON: `returnTo`, `autoRefundAck`, `consentVersion`. `returnTo` só em `/dashboard` ou `/onboarding`; o resto cai em `/dashboard`. Consentimento válido: `autoRefundAck` é `true`, `on` ou `1`, e `consentVersion` é `2026-10-09.v4` (`MP_CONNECT_CONSENT_VERSION` em `lib/mercadopago/consent.ts`, junto com `MP_CONNECT_CONSENT_TEXT`). Sucesso: `303` para a autorização do Mercado Pago, com `state` anti-CSRF e cookie httpOnly. Os campos de PKCE só entram com `MP_OAUTH_PKCE=on`. Sem consentimento: navegação recebe `303` para `returnTo?mp=error&reason=auto_refund_ack_required`; com `Accept: application/json`, `400` `{ "error": { "code": "auto_refund_ack_required" } }`. Se a conexão já tem essa versão, a reconexão não pede o ack de novo e reaproveita o hash já gravado. `Origin` presente e diferente da origem do app, ou `Referer` ausente/alheio quando não há `Origin`: `403` `{ "error": { "code": "forbidden_origin" } }`. |
| `GET /api/businesses/{id}/mercadopago/connect` | `405` com `Allow: POST`. Não inicia OAuth. |
| `POST /api/businesses/{id}/mercadopago/consent` | Dono autenticado. Só com a conta ainda `connected` e com token. Corpo igual ao do connect: `autoRefundAck` e `consentVersion` (`2026-10-09.v4`). Grava versão, hash do texto, `auto_refund_ack_at` e `consent_user_id` sem abrir o Mercado Pago. Responde o mesmo JSON do GET de status, com `canReceiveDeposits: true`. Sem a caixa ou com versão diferente: `400` `auto_refund_ack_required`. Sem conexão ou `disconnected`: `409` `mp_account_not_connected`. `needs_reconnect` ou sem token: `409` `mp_reconnect_required` ("O Mercado Pago encerrou a conexão. Reconecte a conta para aceitar o texto novo."). Origem alheia: `403` `forbidden_origin`. Evento `consent_recorded` com `detail` nulo. A versão e o instante ficam em `consent_version` e `auto_refund_ack_at`. |
| `GET /api/businesses/{id}/mercadopago/consent` | `405` com `Allow: POST`. |
| `GET /api/integrations/mercadopago/callback` | Confere state, sessão e dono. Troca o code em `POST https://api.mercadopago.com/oauth/token` (JSON). Se o cookie da tentativa tem `pkce: true`, o corpo inclui `code_verifier`; se `pkce: false`, não inclui. Redireciona com `mp=connected` ou `mp=error&reason=` (`access_denied`, `state_mismatch`, `expired_code`, `exchange_failed`, `already_linked_elsewhere`). |
| `GET /api/businesses/{id}/mercadopago` | `{ status, connectedAt, expiresAt, liveMode, canReceiveDeposits, consentVersion, accountName, accountEmailMasked, accountIdLast4, hadLegacyPixKey }`. `consentVersion` é a versão registrada ou `null`. `accountName` é o nome derivado (`Ana S.` ou o apelido). `accountEmailMasked` vem de `maskEmail()` em `lib/privacy/mask-email.ts` (`an••@gmail.com`). `accountIdLast4` são os últimos 4 dígitos de `mp_user_id`, calculados na leitura. Os três são `null` quando `status` é `not_connected`. Sem token, sem o `mp_user_id` completo, sem o e-mail completo, sem IP e sem a chave ou o hint. `disconnected` local aparece como `not_connected`. `hadLegacyPixKey` é true só se existe chave inativa e não há aviso dispensado. `canReceiveDeposits` é true só com status `connected`, tokens válidos, `consentVersion` igual a `2026-10-09.v4` e data de aceite preenchida. |
| `POST /api/businesses/{id}/notices/pix_key_retired/dismiss` | Só o dono. Grava `owner_notices` com `booking_id` nulo, `kind = pix_key_retired` e `dismissed_at`. O índice único parcial `(business_id, kind) WHERE booking_id IS NULL` impede a segunda linha. Idempotente. Responde `204`. |
| `DELETE /api/businesses/{id}/mercadopago` | 204. Marca `status=disconnected` e `disconnected_at`. Sem Pix em aberto e sem `expires_at` ou `remote_cancelled_at` nos últimos 24 h, apaga os dois tokens na mesma chamada. Sem nenhum Pix, apaga na hora. Segura o par enquanto houver pagamento `creating`/`pending` com `expires_at` nulo ou com menos de 7 dias, ou `payment_refunds.status` em `requested` ou `processing` (`payments.refund_status = in_process` também segura). Um `creating`/`pending` com `expires_at` há mais de 7 dias não segura o token e não muda o status no Mercado Pago. Com o último `expires_at` ou `remote_cancelled_at` há menos de 24 h, guarda o par só para confirmar ou devolver. Idempotente. |
| `POST /api/webhooks/payments/mercadopago` com tópico `mp-connect` | Valida `x-signature` e a idade do `ts` (±5 min) antes de qualquer dedupe. Sem `x-request-id` utilizável (1 a 128 caracteres, sem caractere de controle) responde `400` e não desconecta. `application.authorized` e ação desconhecida não gravam token. `application.deauthorized` só chama `markDeauthorized` depois que `GET https://api.mercadopago.com/users/me` responde 401, ou responde 400 com JSON `error: invalid_grant`. `invalid_grant` em outro status não desconecta. Resposta 2xx não grava `webhook_events`, responde `503` e não desconecta, para o Mercado Pago reenviar. Timeout, 5xx, rede ou outro status: log `revocation_unconfirmed` com código curto, `503`, sem gravar a entrega e sem desconectar. A linha em `webhook_events` entra na mesma transação do efeito. Conflito de `(provider, request_id)` responde `200` `{ "outcome": "duplicate" }` e não repete o efeito. |
| `GET/POST /api/cron/mercadopago-refresh` | Bearer `CRON_SECRET`. Renova conexões `connected` com `expires_at` em menos de 30 dias. Apaga tokens `disconnected` quando não há Pix em aberto e o último `expires_at` ou `remote_cancelled_at`, se existir, passou há mais de 24 horas. Pix em aberto: `creating`/`pending` com `expires_at` nulo ou com menos de 7 dias, ou devolução `payment_refunds.status` em `requested` ou `processing` (`payments.refund_status = in_process` também). Sem nenhum Pix, apaga na hora. O worker `reconcile` faz o mesmo para todos os negócios. O webhook de pagamento só apaga o negócio daquele evento. |

Erros `{ error: { code, message } }`. Serviço ativo com sinal, e reserva nova com sinal, exigem conta `connected` e o consentimento `2026-10-09.v4`. Sem conexão: 409 `mp_account_not_connected`. Conectada com texto antigo: 409 `mp_consent_outdated`. Em produção (`NODE_ENV` e `MERCADOPAGO_ENV`), conta `connected` com `live_mode` false: 409 `mp_account_test_mode`. Serviço com sinal zero não é bloqueado por este critério. A listagem do painel e a listagem pública incluem `bookable` e `blockedReason`. Pix já criado continua confirmando e devolvendo.

A confirmação da revogação é `GET https://api.mercadopago.com/users/me` com o access token do vendedor. A página oficial de credenciais mostra esse GET no exemplo de Access Token no header ([Credentials](https://www.mercadopago.com.br/developers/en/docs/your-integrations/credentials)). O SDK oficial `mercadopago` faz o mesmo em `User.get` (`GET /users/me`, `src/clients/user/get/index.ts`). HTTP 401 significa token inválido ou expirado. `invalid_grant` está documentado no `POST /oauth/token` ([OAuth /oauth/token](https://www.mercadopago.com.br/developers/en/reference/authentication/oauth/_oauth_token/post)). No `GET /users/me` esse código só conta como revogação com status 400 ou 401; isso é uma suposição defensiva. 5xx com `invalid_grant` não desconecta. O webhook não chama `POST /oauth/token`: o refresh token é de uso único e rotaciona ([renovação](https://www.mercadopago.com.br/developers/en/docs/security/oauth/renewal)). Token ainda válido (2xx) não grava `webhook_events`, responde `503` e não desconecta. Sem access token gravado, a entrega é ignorada (`no_token`) e também não desconecta.

Migration `0020_webhook_events` cria `webhook_events` (`provider`, `request_id`, `received_at`, chave primária nos dois primeiros) e o índice `webhook_events_received_at_idx`. Tem de rodar antes do deploy deste código. Sem ela o dedupe não grava. Não apaga linha nenhuma. Limpeza operacional, retenção de 30 dias, fora do deploy: `DELETE FROM webhook_events WHERE received_at < now() - interval '30 days';`

`getSellerAccessToken(businessId)` cria cobrança e devolve null se não estiver `connected`. `getSellerAccessTokenForSettlement(businessId)` consulta ou confirma pagamento já criado e ainda devolve o token com `disconnected`, sem renovar. Não serve para criar cobrança. `needs_reconnect` devolve null nos dois. `findBusinessIdByMpUserId` só acha linha `connected`.

A migration `0012_inactive_pix_keys_mp_oauth` adiciona `deactivated_at` e `deactivation_reason` em `business_pix_keys` e preenche as linhas já existentes. Não faz DROP nem DELETE desses dados. Cria `mercadopago_connections` (com `consent_version`, `consent_text_sha256`, `auto_refund_ack_at`, `consent_user_id`, `account_display_name` e `account_email_masked`) e `mercadopago_oauth_states` (com `consent_version` e `consent_text_sha256` obrigatórios). O hash é o SHA-256 hex de `MP_CONNECT_CONSENT_TEXT`. O callback copia o consentimento para a conexão e, em seguida, lê `GET https://api.mercadopago.com/users/me` com o token do vendedor. Grava só o nome derivado e o e-mail mascarado. Falha nessa leitura não desfaz a conexão: os dois campos ficam nulos e `mp_connection_events` recebe `kind = account_profile_failed` com `detail` curto (`timeout`, `unreachable`, `invalid_response` ou `http_500`), sem token e sem e-mail. Na reconexão os valores são atualizados. Se continuarem nulos, o próximo refresh de token tenta de novo. Cria `mp_connection_events` com `detail` nulo no consentimento. O IP do evento `consent_recorded` fica só nessa tabela. Cria `owner_notices` com `booking_id uuid` nulo, sem `email_sent_at`. O unique de negócio é o índice parcial `owner_notices_business_kind_uq` em `(business_id, kind) WHERE booking_id IS NULL`. O unique por reserva é `owner_notices_booking_kind_uq` em `(booking_id, kind) WHERE booking_id IS NOT NULL`, para o PR de pagamentos gravar `kind = refund_deadline_eve` uma vez por reserva. Na branch de integração esta migration é a `0012`, depois da `0011` da política do sinal. Não rodar em produção a partir deste PR.

`getPaymentProvider` e o boot do Next (`instrumentation.ts`, fora do edge) chamam `registerSellerAccountHooks`. Criar cobrança usa `getSellerAccessToken`. Consulta, webhook, reconciliação e devolução usam `getSellerAccessTokenForSettlement`. O webhook acha o negócio pelo `user_id` com `findBusinessIdByMpUserId` (só `connected`). A listagem pública já publica `bookable: false` com `blockedReason`.

## Assinatura de R$ 49 — ativação manual (BE-26)

O dono clica em "Assinar por R$ 49/mês", abre o WhatsApp do suporte com a mensagem pronta e o time ativa pelo script admin. O Pix mensal automático (`provider = pix_platform`) fica para depois. A cobrança futura usa só o token da plataforma (`MERCADOPAGO_ACCESS_TOKEN`), nunca o token OAuth de um dono. Esse provedor não está registrado.

Não há valor padrão no código. As duas variáveis ficam na Vercel. Se qualquer uma faltar ou for inválida, o checkout fica indisponível e o processo não quebra no boot.

| Env | Formato |
|---|---|
| `SUPPORT_WHATSAPP_NUMBER` | só dígitos, E.164 sem `+` (`^[1-9][0-9]{7,14}$`) |
| `SUBSCRIPTION_MANUAL_ACTIVATION_HOURS` | inteiro >= 1, sem zero à esquerda |

`.env.example` traz números fictícios. O número real do suporte não entra no repositório.

### GET `/api/businesses/{businessId}/billing`

Mesma autorização do GET billing do #29: sessão do dono. Sem sessão, `401 unauthorized`. Negócio de outro dono ou inexistente, `404 business_unavailable` (o #29 não separa os dois). `businessId` que não é UUID, `400 invalid_input`.

O shape anterior permanece. Entra `checkout`:

```ts
checkout: {
  provider: "manual";
  available: boolean;
  unavailableReason: "config_missing" | null;
  activationHours: number | null;
  pendingRequest: { id: string; requestedAt: string } | null;
}
```

`activationHours` é `null` quando `available` é false. `pendingRequest` é o pedido com `handled_at` nulo e continua presente mesmo com `available: false` (a env pode sair depois do pedido). `requestedAt` é ISO 8601.

Texto de referência para o front, quando houver `pendingRequest`: "Recebemos seu pedido. Ativamos em até {activationHours} h." O texto final é do front. Sem prazo (`activationHours` nulo), o front mostra que o pedido foi recebido e omite as horas.

### POST `/api/businesses/{businessId}/subscription/checkout`

Dono autenticado. A origem segue as outras rotas POST: `403 origin_not_allowed` se o `Origin` não for o do app. Sem body. O provider é o ativo, hoje `manual`.

Cria um pedido ou reaproveita o aberto. Há no máximo um pedido aberto por negócio (índice parcial). Repetir o POST devolve o mesmo `id` e o mesmo `requestedAt`. A URL do WhatsApp é montada de novo com o slug atual.

`Accept` sem `application/json` (form HTML): **303** `Location` = `https://wa.me/{SUPPORT_WHATSAPP_NUMBER}?text=` + `encodeURIComponent` de `Quero assinar o AgendaPix. Meu link: {url pública}`. A URL pública é a origem de `BETTER_AUTH_URL` mais `publicBookingPagePath(slug)`.

`Accept: application/json`: **200**

```ts
{
  provider: "manual";
  request: { id: string; requestedAt: string };
  whatsappUrl: string;
  activationHours: number;
}
```

O form do front deve usar `target="_blank"` (`<form method="post" action="/api/businesses/{businessId}/subscription/checkout" target="_blank">`). Funciona sem JS, não esbarra em bloqueio de popup e o painel continua aberto. Ao voltar o foco, o front refaz o GET billing.

Erros deste POST são JSON, também no form. Não há redirect de erro. O envelope segue o helper das rotas: `{ error: { code, message } }`. O front decide pelo `code`.

| HTTP | code | Quando |
|---|---|---|
| 401 | `unauthorized` | sem sessão |
| 403 | `origin_not_allowed` | origem fora do app |
| 404 | `business_unavailable` | negócio inexistente ou de outro dono |
| 409 | `subscription_already_active` | `subscription.status === "active"` e faltam mais de 3 dias de calendário, no fuso do negócio, até `currentPeriodEnd` |
| 503 | `checkout_unavailable` | env ausente ou inválida, ou a URL pública não pôde ser montada |

A partir do D-3 (3, 2, 1, 0 ou dia já passado) o POST é aceito: é renovação. `trialing`, `past_due`, `canceled` e assinatura sem `currentPeriodEnd` não geram 409. O front só mostra "Assinar por R$ 49/mês" quando `checkout.available === true` e não haveria 409.

Não há helper de limite reutilizável para rota autenticada do dono. O limite de `lib/bookings/rate-limit.ts` é só do agendamento público. Este POST não cria outro.

### Pedido, script e fim do período

Tabela `subscription_requests`: `id`, `business_id`, `provider`, `requested_at`, `handled_at`, `handled_by`. `handled_at` e `handled_by` são os dois nulos ou os dois preenchidos.

`pnpm billing:activate -- --business <id|slug> --by <operador> [--months 1] [--dry-run]` e `pnpm billing:requests`. `--months` padrão 1. `--by` é obrigatório. Sem `DATABASE_URL` válida o script para com erro claro e não conecta. Só roda com aprovação do dono. Não apontar para produção por conta própria.

Na transação, a ativação grava `subscriptions.status = active`, `provider = manual` e `current_period_end`. Se a regra de acesso do #29 ainda libera (status `active` ou `trialing` com fim no futuro), soma os meses a esse fim, no fuso do negócio. Senão, soma a agora. Fecha o pedido aberto (`handled_at`, `handled_by`). Não há tabela de auditoria para assinatura (`payment_audit` exige pagamento e reserva): o script escreve um log JSON `subscription_activated` (ou `subscription_activation_dry_run`). `--dry-run` não grava. A pausa sai na hora porque `bookingsPaused` é calculado a cada request.

Quando `current_period_end` passa sem renovação, o acesso cai pela regra do #29 e a agenda volta a pausar.

O #29 tem cron de reconciliação de Pix (`lib/payments/cron.ts`), não de aviso de assinatura. O lembrete idempotente de D-3 do período pago, com botão para o mesmo checkout, fica pendente. Esta entrega não cria essa infra.

Na branch de integração esta migration é a `0015_subscription_requests`, depois das duas do Pix (`0013` e `0014`). O #33 tem duas migrations, então o número não é 0014.

## Perfil do negócio

Contratos Zod em `lib/contracts` (`business-profile.ts`, `errors.ts`, reexportados por `index.ts`). O front importa dali. Não há default de nome, slug ou logo.

| Export | Forma |
| --- | --- |
| `businessProfileSchema` | `{ name, slug, logoUrl }` obrigatórios no perfil completo. Nome 2–60, slug 3–40 com a lista reservada de `lib/slug.ts`, logo `https` em `*.public.blob.vercel-storage.com`. |
| `onboardingInputSchema` | sem `logoUrl`. O objeto é `.strict()`: a chave `logoUrl` (e qualquer outra desconhecida) é `400 invalid_input`. O cadastro não grava `logo_url`. |
| `businessProfilePatchRequestSchema` | parcial, pelo menos nome ou slug. Sem `logoUrl`: a chave extra é `400 invalid_input`. `null` não apaga. |
| `businessProfileResponseSchema` | `{ id, name, slug, logoUrl, publicPath, publicUrl }`. `logoUrl` e `publicUrl` podem ser `null`. |
| `logoUploadResponseSchema` | `{ logoUrl }`. |
| `slugAvailabilityResponseSchema` | `{ input, normalized, valid, available, reason, suggestions }`. `reason`: `taken`, `reserved`, `invalid` ou `too_short` (este último a tela de cadastro já usa). `suggestions` tem no máximo 3 e vem vazio quando o link está livre, inválido ou curto. |
| `apiErrorCodeSchema` | `invalid_input`, `unauthorized`, `business_unavailable`, `slug_taken`, `rate_limited`, `logo_invalid`, `logo_too_large`, `blob_unavailable`, `internal_error`, e os do link de horário: `link_expired`, `link_used`, `link_in_progress`, `link_cancelled`, `link_replaced`, `link_invalid`, `slot_unavailable`, `mp_not_connected`. |

O corpo de erro continua `{ error: { code, message, details? } }`. `handleHttp` espalha `error.details` no objeto `error`.

`GET /api/public/slugs/availability?slug=&segment=&uf=` permanece o caminho. Sem sessão, só leitura, 30 por minuto por IP. `suggestions` sai de uma consulta só (`businesses.slug` UNION alias ainda bloqueado). Alias ativo e alias solto há menos de 90 dias contam como `taken`, mesmo quando o negócio de origem ainda pode recuperá-lo no PATCH. Alias solto há 90 dias ou mais não entra. Ordem dos candidatos: sufixo do segmento, sem hífen, UF, depois `-2`…`-12`.

`PATCH /api/businesses/{businessId}/profile` exige sessão e dono. `401 unauthorized`, `404 business_unavailable` (uuid inválido ou negócio de outro), `400 invalid_input` com `details.fields` (corpo JSON inválido também), `409 slug_taken` com `details.constraint` (`slug`, `slug_alias` ou `businesses_slug_unique`) e `details.suggestions` (até 3 links livres). A corrida do índice único ou do gatilho (`23505`) no PATCH e na criação do negócio usa o mesmo `409 slug_taken` com `details.suggestions`, para a tela oferecer outro link na hora. O rascunho do cadastro continua `409 slug_unavailable` com `suggestions` no topo. Corpo com `logoUrl` é `400 invalid_input` e não grava nada. Resposta `200` no formato acima. `publicPath` é `/{slug}`. `publicUrl` usa `BETTER_AUTH_URL` (`publicBusinessPageUrl`). A origem canônica segue `NEXT_PUBLIC_SITE_URL` (`siteOrigin`). Não há env nova de prefixo.

Todo PATCH conta no teto geral: 30 por dono por hora, `429 rate_limited` com `Retry-After`. Troca de slug (o valor mudou) conta à parte: 3 por dono a cada 30 dias, o mesmo `429`. Conflito `409` não consome uma das 3 trocas.

`POST /api/businesses/{businessId}/logo` é o único caminho que grava `businesses.logo_url`. `multipart` no campo `logo`, runtime Node. Sessão, dono e o teto de 10 envios por hora vêm antes de ler o corpo. `Content-Length` acima de 2 MB mais 16 KB de envelope responde `413 logo_too_large` sem ler o corpo. Sem esse cabeçalho, a leitura para no mesmo teto. PNG, JPEG ou WebP até 2 MB, conferidos pelos bytes. SVG e o resto: `400 logo_invalid`. Sharp reduz ao máximo 512 px sem aumentar e grava WebP sem EXIF. `put` usa `access: "public"` e `addRandomSuffix: true` ([docs](https://vercel.com/docs/vercel-blob/using-blob-sdk#put)). Sem `BLOB_READ_WRITE_TOKEN` em produção: `503 blob_unavailable`, sem cair no host falso. Fora de produção o adaptador falso grava `https://blob.fake.local/...`. Depois que a coluna grava a URL nova, a anterior sai do armazenamento se o host for o nosso e o caminho for `/logos/{businessId}`. Falha ao apagar não desfaz o envio.

Não há prazo que simplesmente libere um link antigo para qualquer um. Enquanto o alias está ativo (`released_at` nulo) a página `/{slug}`, os subcaminhos e `/api/public/{slug}/...` respondem `308` (`Cache-Control: no-store`, query preservada). No máximo 3 aliases ativos por negócio. A troca que passaria de 3 grava `released_at = now()` no mais antigo: esse link passa a `404` e continua `taken` para os outros por 90 dias. Só depois disso outro negócio pode usá-lo. O negócio de origem recupera o seu (ativo ou solto dentro dos 90 dias): a linha sai e o slug que ele deixa entra no lugar. O proxy guarda alias positivo por 60 segundos, no máximo 256 entradas. Um slug que existe em `businesses` nunca entra como negativo: outra instância pode trocar o nome e o link antigo responde 308 na hora. Slug que não existe fica no máximo 5 segundos (mesmo teto de 256) para a mesma URL inexistente não consultar o banco em toda visita. Passou de 80 consultas por segundo, o proxy segue sem redirect e sem guardar esse resultado. Erro de banco não entra no cache. Quando o slug não está em `businesses`, serviços, horários, reserva e consulta do Pix leem o alias com `readAliasTarget`, direto no banco e sem essa memória. Em `/api/public/{slug}/...`, só a falha `42P01` (tabela ausente) segue sem redirect: o código vai para o log, sem detalhe do banco, e qualquer outro erro sobe. Trocar o slug, criar a loja ou soltar um alias apaga, neste processo, a entrada positiva e a entrada de slug ausente daquele link. O proxy e as rotas compartilham os dois mapas, então um não continua servindo o resultado que o outro já invalidou. O cache positivo continua só com alias que redireciona. Ausência e erro de banco não entram nele. Outro processo ainda espera o prazo do mapa (60 s no alias, 5 s no ausente). `/dashboard`, `/onboarding`, `/login` e `/api/public/slugs/availability` não consultam alias.

O cadastro cria a página sem URL de logo. `logoUrl` no corpo do rascunho, do commit ou de `POST /api/onboarding` é `400 invalid_input` e não grava a coluna. O arquivo fica no navegador até existir `businessId`; em seguida o POST da logo grava a coluna.

Migration `db/migrations/0018_business_profile.sql` tem de rodar antes do deploy deste código. Sem ela, o SELECT de `businesses.logo_url` responde 500. A migration cria a coluna `logo_url`, a tabela `business_slug_history` com `released_at` e o gatilho que recusa slug atual contra alias ativo ou solto há menos de 90 dias (`23505`). CSP `img-src` inclui `https://*.public.blob.vercel-storage.com`. `https://blob.fake.local` só entra com `NODE_ENV=development`. `serverExternalPackages` inclui `sharp`.

## Link de um horário

Contratos em `lib/contracts/slot-link.ts`, reexportados por `lib/contracts/index.ts`. O corpo de erro é `{ error: { code, message, details? } }` via `handleHttp`. `slotLinkErrorCodeSchema` junta `link_expired`, `link_used`, `link_in_progress`, `link_cancelled`, `link_replaced`, `link_invalid`, `slot_unavailable`, `mp_not_connected` com `invalid_input`, `rate_limited`, `unauthorized`, `business_unavailable`, `origin_not_allowed` e `body_too_large`.

Gerar o link não cria reserva nem cobrança. O hold e o Pix nascem só no POST de pagamento, pelo mesmo fluxo da reserva pública (`createBooking`). Um `23P01` da exclusão de horário vira `409 slot_unavailable`.

Prazo: `SLOT_LINK_TTL_MINUTES`, padrão **1440** (24 horas), faixa **15–10080**. Valor inválido cai no mesmo `bookingConfig` / `assertProductionSafeEnv` das outras envs de reserva (`503 booking_unavailable` na primeira uso; em produção o boot recusa). O `expiresAt` gravado é `min(agora + prazo, startsAt)`: o link nunca vence depois do início do horário. O check no banco é `expires_at <= starts_at`.

Token: 32 bytes de `crypto.randomBytes`, base64url (43 caracteres), no **path**, nunca no fragmento. A coluna guarda só o sha256. Formato inválido responde `404 link_invalid` sem consultar o banco. Token desconhecido, malformado ou de outro negócio devolve o mesmo `404 link_invalid` e a mesma mensagem, sem dizer se o token existiu. `previewId` é outro aleatório de 16 bytes (22 caracteres). Não deriva o token e não autoriza pagamento.

Nome e WhatsApp da cliente só entram na reserva, com a mesma retenção de `customers` / `bookings`. O `customerLabel` opcional é lembrete do dono: não volta no link público e não preenche o cadastro. Ele fica só até o horário começar (`starts_at` < agora): o cron diário (`GET`/`POST /api/cron/reconcile`) grava `NULL`. A linha do link continua. Não há fluxo de exclusão de conta. O FK `slot_links.business_id` é `ON DELETE CASCADE`: apagar o negócio apaga os links e o histórico `slot_link_bookings`.

| Método e rota | Schema do pedido | Schema da resposta |
| --- | --- | --- |
| `POST /api/businesses/{businessId}/slot-links` | `slotLinkCreateRequestSchema` `{ serviceId, date, time, customerLabel? }` | `201` `slotLinkCreatedResponseSchema` (inclui `token` e `path` uma vez) |
| `GET /api/businesses/{businessId}/slot-links?date=YYYY-MM-DD&cursor=&limit=` | `slotLinkListQuerySchema` | `slotLinkListResponseSchema` |
| `POST /api/businesses/{businessId}/slot-links/{linkId}/cancel` | sem corpo | `slotLinkOwnerSchema` |
| `POST /api/businesses/{businessId}/slot-links/{linkId}/reissue` | sem corpo | `201` `slotLinkCreatedResponseSchema` (token novo) |
| `GET /api/public/{slug}/slot-links/{token}` | — | `slotLinkOpenResponseSchema` |
| `POST /api/public/{slug}/slot-links/{token}/pay` | header `Idempotency-Key` (16–128, base64url ou UUID) + `slotLinkPayRequestSchema` `{ customer: { name, phone, cpfCnpj? }, policyHash }` | `201` `slotLinkPayResponseSchema` |
| `GET /api/public/slot-link-previews/{previewId}` | — | `slotLinkPreviewResponseSchema` |

O GET público resolve o negócio pelo slug e só então compara o hash do token, para token desconhecido e token de outra loja seguirem o mesmo caminho. Revalida o horário em toda leitura e devolve `status`: `pending`, `paid`, `expired`, `taken` ou `cancelled`. Horário que já começou devolve `expired`, mesmo que o intervalo esteja ocupado. Também devolve negócio, serviço, `startsAt`, `depositCents`, `remainingCents`, política (`text` + `hash`) e `expiresAt`. Não devolve nome, telefone nem o token. As respostas desse path levam `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex, nofollow`. O matcher do proxy ignora prefetch; a mesma trinca vai em `headers()` para `/:slug/h/:token`. Nenhum `<Link>` aponta para essa rota. O token não entra em log de aplicação; `redactSlotLinkToken` cobre o path se uma mensagem de erro o ecoar. Não há Sentry neste processo. O token no path aparece nos logs de request da Vercel: a decisão de retenção e acesso está pendente com o Matiss (ver `docs/deploy-vercel.md`).

A prévia de um link `pending` é `{ kind: "slot", businessName, logoUrl, serviceName, date, time }`. Qualquer outro status de um `previewId` conhecido responde `200` `{ kind: "generic", businessName, logoUrl }` — sem serviço, data ou hora, e sem `404`. `previewId` desconhecido ou malformado continua `404 link_invalid`. Não traz disponibilidade, sinal nem dado da cliente. Com IP, a rota usa o mesmo teto de abertura (`SLOT_LINK_OPEN_PER_CLIENT`) e os mesmos cabeçalhos de privacidade. Sem IP, vale o teto anônimo descrito abaixo.

O POST de pagamento exige `Idempotency-Key`. Ausente ou fora do formato: `400 invalid_input`. O banco guarda só o HMAC dessa chave com o segredo de acesso atual (`BOOKING_ACCESS_SECRET`). Fora de produção, se esse segredo estiver vazio, o HMAC ainda usa `BETTER_AUTH_SECRET`. Em produção não usa. Com `BOOKING_ACCESS_SECRET_PREVIOUS` definido, a busca casa o HMAC gravado com o segredo atual ou com o anterior, em tempo constante, e retoma o Pix começado antes da rotação. Sem `PREVIOUS`, esse HMAC antigo não é encontrado: a mesma chave, com o claim ainda ativo, responde `409 link_in_progress` e não retoma o pagamento. Token novo de acompanhamento sai só com o segredo atual. O banco guarda o sha256 desse token. A leitura compara, em tempo constante, o sha256 do token apresentado com `accessTokenHash`. A rotação não invalida o link que o cliente já tem e essa leitura não consulta `PREVIOUS`. Na retomada da mesma chave, o `accessToken` da resposta é o do segredo atual ou o de `PREVIOUS`, aquele cujo sha256 bate com o hash gravado. Se nenhum bate, volta o do segredo atual, o hash gravado não muda, e o processo avisa só o id da reserva: o link não pôde ser restaurado e `BOOKING_ACCESS_SECRET_PREVIOUS` precisa estar definido na rotação. Não rotacione de novo nem apague `PREVIOUS` enquanto houver Pix de link de horário começado antes da rotação ainda pendente. Não é sha256 do id do link. A `requestKey` da reserva é um UUID derivado desse HMAC. A mesma chave, com o claim ainda dentro do hold e a reserva sem pagamento, chama `createBooking` de novo com a mesma `requestKey`. O `createBooking` acha a reserva e devolve a mesma linha de `payments` (mesmo id, mesmo QR, mesmo copia-e-cola) e o `accessToken` derivado do id da reserva. Isso vale mesmo se o `expiresAt` do link já passou: só um claim novo olha esse prazo. Chave diferente nesse claim: `409 link_in_progress`, sem dado da outra cliente. Se o prazo do link já passou, a chave diferente recebe `410 link_expired`. Claim vencido (`pay_started_at < now() - BOOKING_HOLD_MINUTES`, reserva não paga) e prazo do link ainda válido: qualquer chave assume pelo mesmo `UPDATE ... WHERE booking_id IS NULL AND (pay_started_at IS NULL OR pay_started_at < now() - hold)`. Antes disso, na mesma transação, a reserva pendente passa por `expirePending`. Um Pix antigo que chegar depois cai em `resolveLatePayment` / `late_payment_policy` e não confirma por cima da reserva nova. Cada reserva nascida do link fica em `slot_link_bookings`. Só `late_rebooked` (a reserva antiga confirmada) marca o link como `paid` e aponta `booking_id` para ela. `late_no_slot` não marca. Pago: `409 link_used` para qualquer chave nova; o GET mostra `paid`.

`slotLinkOwnerSchema` inclui `cancellable`. É verdadeiro quando não há reserva ligada e o claim está livre ou vencido. O dono cancela nesse caso. Claim fresco ou reserva ligada: `409 link_used`.

Códigos depois que o hash confere: `410 link_expired`, `409 link_used`, `409 link_in_progress`, `409 link_cancelled`, `409 link_replaced`, `409 slot_unavailable`, `409 mp_not_connected`, `409 idempotency_conflict`. Antes disso, qualquer token que não casa é `404 link_invalid`. `link_replaced` não traz o token nem o path do link novo.

`POST .../reissue` usa `findOwnedBusiness`, `requireAppOrigin` e o mesmo teto de criação por dono. Numa transação, trava a linha com `SELECT ... FOR UPDATE`. Só um link `pending` sem claim ativo (`pay_started_at` dentro do hold, ou reserva `pending_payment` com hold vigente) pode ser trocado. Claim ativo: `409 link_in_progress` e o link antigo continua válido. Horário ocupado: `409 slot_unavailable` e o antigo continua `pending`. No sucesso, o antigo fica `replaced` com `replaced_by_link_id` e nasce outro link do mesmo serviço e horário, com `expiresAt` recalculado (`min(agora + prazo, startsAt)`) e token novo. O token antigo responde `409 link_replaced`. A lista do dono mostra `replaced`.

A lista não recebe o token, então não há “Copiar link” nela. `replaced` aparece como “Substituído”, sem gerar de novo nem cancelar. O `pending` novo fica acima (`createdAt` desc). `429 rate_limited` e `5xx` usam o mesmo texto de falha ao gerar. `409 link_used`, `410 link_expired` e `409 mp_not_connected` ficam na confirmação; ao fechá-la a lista recarrega. O cancelamento do dono faz o mesmo com `link_used` e `link_expired`.

Para a cliente, só `409 link_replaced` abre “Este link foi atualizado. Peça o link novo para {loja}.” Não há `reason`. `link_cancelled` continua “Este link não está mais disponível.” A tela de expirado só entra com `410 link_expired` (ou horário de atendimento que já começou). `429` e `5xx` não são erro final: “Não conseguimos carregar agora.” `409 idempotency_conflict` segue valendo quando a mesma chave volta com outro nome, WhatsApp ou política.

No navegador, `agendapix.slot-link.pay.` + sha256 do token fica no localStorage com a Idempotency-Key, nome, WhatsApp, hash da política e o prazo da retomada: o maior entre o hold da reserva e `expiresAt` do link mais a janela do hold. Sem CPF e sem `accessToken`. O `accessToken` fica só no sessionStorage, em `agendapix.slot-link.session.` + o mesmo hash. `booking_session_{slug}` também é sessionStorage. A abertura do app apaga `booking_session_*` vencido no sessionStorage e no localStorage. Se já houver token guardado para o mesmo `bookingId`, a resposta nova não substitui esse token. Outro `bookingId`, ou a ausência de token, grava o da resposta. `generateMetadata` usa a chave slug + hash do token. Cache positivo (60 s): devolve a prévia completa sem banco e sem limitador. Cache negativo (5 s): devolve só nome e logo da loja. Sem cache, se o balde daquela identidade já estourou, devolve o genérico sem consultar o token. Se não estourou, consulta. Achou: grava o positivo e não consome o balde; a prévia sai de `readSlotLinkPreview` sem `probeLimit`. Não achou: consome o escopo `slot-link-preview` (`SLOT_LINK_OPEN_PER_CLIENT`) da `bookingClientIdentity` e grava o negativo. Sem identidade o balde é `metadata-no-identity`, separado das identidades e do balde global anônimo. O mapa de tokens tem tetos separados de 256 chaves válidas e 256 de “não achou” (LRU): token falso não expulsa prévia válida. Nome e logo ficam noutro mapa desta instância, 90 s por slug que existe e 30 s quando o slug não existe, cada um com teto de 256. Com o balde estourado a página devolve o genérico fixo da AgendaPix, sem logo e sem SELECT em `businesses`. Trocar nome, slug ou logo apaga essa entrada. Se a leitura do balde falhar, a prévia genérica segue e o processo registra um aviso sem token nem hash.

`GET` do pagamento com token que não casa continua `404` `booking_not_found`. A tela de acompanhamento mostra “Este link de acompanhamento foi atualizado. Para ver os detalhes do seu agendamento, fale com a loja.” Com slug e WhatsApp da loja, o botão “Falar com a loja” abre o `wa.me`. Sem slug, o texto de apoio é “Procure a mensagem da loja no seu WhatsApp para falar com ela.”

Limites, janela de 1 minuto. O IP vem só de `bookingClientIdentity` (o handler não lê `X-Forwarded-For` na mão). O teto por IP entra primeiro. O teto por token só conta depois que o hash casa, para token aleatório não criar linha em `abuse_rate_limits`. Sem IP, o probe usa um balde global com teto de 10000 por minuto, não o teto por cliente. Esse balde só existe fora da Vercel: em produção `BOOKING_TRUST_PROXY` está ligado e a plataforma manda o IP. O teto por negócio continua valendo depois que o hash casa.

- criar: `SLOT_LINK_CREATE_PER_OWNER` (padrão 30) por dono no negócio
- abrir e prévia: `SLOT_LINK_OPEN_PER_CLIENT` (padrão 60) e, na abertura, `SLOT_LINK_OPEN_PER_BUSINESS` (padrão 600)
- pagar: `SLOT_LINK_PAY_PER_CLIENT` (padrão 10), `SLOT_LINK_PAY_PER_BUSINESS` (padrão 120) e `SLOT_LINK_PAY_PER_TOKEN` (padrão 5) no hash do token

POST do dono exige sessão (`401` sem sessão) e `requireAppOrigin`. O negócio passa por `findOwnedBusiness`. Serviço de outro negócio não entra. Dono A não lista nem cancela link do dono B (`404`).

Status: `paid` quando alguma reserva nascida do link confirma, inclusive `late_rebooked` da reserva antiga (o webhook e a reconciliação marcam o link na mesma transação de `applyPaidEvent`). `late_no_slot` não marca pago: a lista segue a reserva atual (`pending` se o hold dela vale, `paid` se ela confirmou) e fica `expired` se esse hold também venceu. `expired` também quando passa `expiresAt` ou `startsAt`; `taken` quando outra reserva ocupa o intervalo e o horário ainda não começou; `cancelled` quando o dono cancela; `pending` no restante. `paid` e `cancelled` não voltam atrás. Hold vencido sem pagamento não trava um claim novo enquanto o prazo do link existir. O cancelamento do dono usa `now()` do banco, o mesmo relógio do claim.

Migration `0021_slot_links` tem de rodar **antes** do deploy. Sem a tabela, estas rotas respondem 500. O número é o próximo livre no master depois de `0020_webhook_events`. Se outro PR ocupar `0021` antes do merge, renumerar o arquivo, o snapshot e o journal.

Rollout, nesta ordem, sem apontar o script para produção por conta de um agente:

1. No Neon, crie o branch de backup `backup-pre-0021` a partir do branch `production`.
2. Na Vercel, crie `BOOKING_ACCESS_SECRET` em Production e em Preview, com valores diferentes, **antes** do deploy. Cada um sai de `openssl rand -base64 32`, tem pelo menos 32 caracteres, não pode ser igual a `BETTER_AUTH_SECRET` e não pode usar o prefixo de exemplo. O boot (`NODE_ENV=production`, `assertProductionSafeEnv`) e o `next build` com `VERCEL_ENV=production` ou `VERCEL_ENV=preview` (`assertVercelProductionBuild`) recusam subir sem isso. A mensagem cita o nome da variável e o motivo, nunca o valor. O link de acompanhamento que o cliente já tem continua válido depois da rotação: a leitura compara o sha256 do token com o hash gravado e não precisa de `BOOKING_ACCESS_SECRET_PREVIOUS`. Esse `PREVIOUS` serve para retomar um Pix do link de horário começado com o segredo antigo. Se `BOOKING_ACCESS_SECRET` estava vazio, esse HMAC usava `BETTER_AUTH_SECRET`: grave esse valor em `PREVIOUS` até esses pagamentos terminarem. `PREVIOUS` precisa ter pelo menos 32 caracteres; abaixo disso não entra. Pode ser igual a `BETTER_AUTH_SECRET`; o segredo atual não pode. Se `PREVIOUS` repetir `BOOKING_ACCESS_SECRET`, o boot avisa, sem o valor. O boot também avisa uma vez, sem o valor, que `PREVIOUS` só vale para Pix de link de horário já começado antes da rotação, e para removê-lo depois. Não rotacione uma segunda vez nem apague `PREVIOUS` enquanto esses Pix ainda estiverem pendentes: sem o segredo antigo, a retomada não restaura o link de acompanhamento (o hash gravado fica como está e o aviso leva só o id da reserva).
3. Aplique a migration na URL **direta** do Neon (sem `-pooler`). A URL sai, nesta ordem, e o script imprime só a origem (`env`, `.env.migrate`, `.env` ou `prompt`), nunca o valor: `DATABASE_URL` já no ambiente; senão `.env.migrate` (gitignore; modelo em `.env.migrate.example`); senão o `.env`; senão, se o stdin for um terminal, o prompt oculto. Colar a URL e o Enter no mesmo bloco conta como um Enter. Com stdin TTY, a confirmação das migrations pendentes aparece também quando a URL veio do ambiente, salvo `--yes`. Sem TTY, só `DATABASE_URL` já no ambiente segue sem `--yes` (CI e Docker). `.env` e `.env.migrate` exigem `--yes`. Sem URL, o script sai com erro em vez de esperar input. Apague `.env.migrate` depois.
4. Só então faça o merge e o deploy.
