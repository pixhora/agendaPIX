# Pix do sinal (Payments API)

A cobrança usa `POST /v1/payments` (Checkout Transparente), não Orders. O Split/marketplace do Mercado Pago documenta Checkout Pro, Checkout Transparente e Bricks. Orders online com o token OAuth do vendedor não está documentado.

Fontes:

- https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
- https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
- Estorno: https://www.mercadopago.com.br/developers/pt/reference/chargebacks/_payments_id_refunds/post
- Webhook: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks

## Token

O sinal sai com o access token OAuth do vendedor, cifrado em `mercadopago_connections`. `getPaymentProvider` e o boot do Next (`instrumentation.ts`, só fora do edge) chamam `registerSellerAccountHooks()`, que liga `getSellerAccessToken`, `getSellerAccessTokenForSettlement` e `findBusinessIdByMpUserId`. O worker de reconciliação não sobe o Next, então o registro também fica em `getPaymentProvider`. A taxa da plataforma é zero: o `POST /v1/payments` não envia `application_fee`. A assinatura de R$ 49 não usa este token.

```ts
resolveMpAccessToken(query: {
  businessId?: string;
  mpUserId?: string;
  purpose?: "settlement" | "charge";
}, env?): Promise<string>
getSellerAccessToken(businessId: string): Promise<{ accessToken: string; mpUserId: string } | null>
getSellerAccessTokenForSettlement(businessId: string): Promise<{ accessToken: string; mpUserId: string } | null>
findBusinessIdByMpUserId(mpUserId: string): Promise<string | null>
```

`resolveMpAccessToken` é o único ponto que o pagamento chama. Com os ganchos do boot, `charge` usa `getSellerAccessToken` (e renova se faltar menos de 1 dia) e `settlement` usa `getSellerAccessTokenForSettlement`. Se só houver `mpUserId`, `findBusinessIdByMpUserId` acha o negócio `connected`. Gancho que devolve null não cai no token da plataforma. `charge` falha com `mp_account_not_connected` se o dono desconectou. `settlement` pode usar o token retido depois da desconexão. O webhook usa `user_id` da notificação com `purpose: "settlement"`. `options.accessToken` substitui o resultado só naquela chamada. Sem os ganchos (teste que ainda não subiu o boot), as duas finalidades usam `MERCADOPAGO_ACCESS_TOKEN`.

```ts
createPixCharge(input, { signal, businessId, mpUserId, accessToken, purpose: "charge" })
getCharge(externalId, { signal, businessId, mpUserId, accessToken, purpose: "settlement" })
findChargeByReference(reference, { signal, businessId, mpUserId, accessToken, purpose: "settlement" })
cancelCharge(externalId, { signal, businessId, mpUserId, accessToken, purpose: "settlement" })
refundCharge(externalId, { idempotencyKey }, { signal, businessId, mpUserId, accessToken, purpose: "settlement" })
```

`getPaymentProvider` injeta `(query) => resolveMpAccessToken(query, env)`.

## Pedido

`POST /v1/payments` com `payment_method_id: "pix"`, `transaction_amount`, `payer.email` (`hold-{reference}@pagador.agendapix.invalid` sem e-mail), `external_reference`, `notification_url`, `date_of_expiration` e `X-Idempotency-Key`. Sem `application_fee` (taxa zero).

`date_of_expiration` = fim do hold + **2 minutos** (`MERCADOPAGO_PIX_EXPIRATION_MARGIN_MINUTES`), em ISO-8601 com offset. A doc aceita de 30 minutos a 30 dias. `BOOKING_HOLD_MINUTES` tem padrão **30** e faixa **28–43200**: 28 + 2 = 30, o mínimo do `/v1/payments`. Abaixo de 28 a reserva responde `503` `booking_unavailable`, com a mensagem `BOOKING_HOLD_MINUTES inválido`. O `expiresAt` que a tela recebe continua sendo só o hold. "Pago no prazo" usa `date_approved` do `GET /v1/payments/{id}` (string ISO-8601, ex.: `2017-08-31T11:26:38.000Z`), não a hora em que o webhook ou a reconciliação processa o evento. A tolerância é a mesma margem do Pix: aprovação até `expiresAt` + 2 minutos (`PIX_APPROVAL_TOLERANCE_MS`, porque o Mercado Pago aceita o Pix até `date_of_expiration`). Doc: https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/get-payment/get. Sem `date_approved` válido não usamos `date_created`: o evento segue com `paidAtSource: "fallback"` e só confirma se o hold ainda segura o horário; depois disso entra na política de atraso. `date_approved` mais de 5 minutos à frente do relógio local é rejeitado (`future_payment`). Se a aprovação foi no prazo mas a reserva já expirou, o horário livre é retomado (`on_time_reclaimed`); se outra pessoa ocupou, grava `late_no_slot` e o estorno sai depois do commit. Os dois caminhos (`on_time_reclaimed` e `rebook_if_free`) usam savepoint no 23P01. `MP_REQUIRES_PAYER_CPF` continua com padrão `false`.

QR e copia-e-cola saem de `point_of_interaction.transaction_data` (`qr_code`, `qr_code_base64`, `ticket_url`) e voltam nos campos atuais: `copyPaste` e `qrCodeDataUrl`.

## Status

| Mercado Pago | Efeito |
| --- | --- |
| `approved` + `status_detail: accredited` | pago; confirma se `date_approved` ≤ hold + 2 min e o horário segue livre |
| `pending` / `pending_waiting_transfer` | aguardando |
| `cancelled` / `expired` | não confirma |
| `refunded` / `charged_back` | não confirma |

`status_detail` vai no `payment_audit`. Estorno total: `POST /v1/payments/{id}/refunds`, corpo `{}` (sem `amount`), `X-Idempotency-Key` gerada no servidor (`{paymentId}:{n}` na devolução do dono, `auto_late:{paymentId}` no atraso) e `X-Render-In-Process-Refunds: true`. O token é `resolveMpAccessToken({ businessId, purpose: "settlement" })`. A devolução automática é todo Pix pago depois do prazo da reserva (`late_no_slot`, política padrão `refund`, causa `window_expired`), fora da transação de confirmação. Com `rebook_if_free`, horário livre e ainda no futuro vira `late_rebooked`; horário ocupado usa savepoint para o `23P01` não abortar a transação e grava causa `slot_taken`. O webhook e o GET gravam o evento, commitam, e estornam fora do lock com `PAYMENT_PROVIDER_TIMEOUT_MS`. Timeout ou falha não devolve erro ao gateway: o reconciliador retoma a mesma chave. Falha do Mercado Pago vira `refundStatus: failed` e grava `manualRefundDueAt` no fim do 7º dia local (`MANUAL_REFUND_DEADLINE_DAYS`). O aviso `unverifiable_seller_disconnected` grava o mesmo prazo. O e-mail ao dono mostra a data no fuso do negócio (ex.: "sáb, 8 jun"), sem hora de Brasília, e a causa da auditoria. Vencer esse prazo não estorna, não cobra e não cancela. A primeira devolução pela política, mesmo sem saldo, grava `policy_refund_requested_on` e o prazo; uma nova tentativa não muda os dois. O rótulo da marcação manual é "Devolvi pelo Mercado Pago". O estorno sai do saldo do vendedor: o Split 1:1 diz que o marketplace não emite reembolso total se o vendedor não tiver fundos.

A notificação de webhook traz `type`, `action`, `user_id` e `data.id`. Não traz o status. A consulta é `GET /v1/payments/{id}` com o token do vendedor. Sem token, o AgendaPix não confirma: grava `unverifiable_seller_disconnected` e avisa o dono por e-mail. Não há tabela de aviso no painel.

Pagamento atrasado com horário livre, ainda no futuro, e política `rebook_if_free` grava `confirmed` (`late_rebooked`), sem devolução. A política padrão `refund` devolve mesmo com o horário livre. Não há repasse: o Pix cai na conta do dono. Antes de `confirmed`, o atraso não é tratado como confirmado.

## CPF

`requiresPayerCpf` vem de `MP_REQUIRES_PAYER_CPF` (padrão `false`). A referência do `POST /v1/payments` não marca `payer.identification` como obrigatório; o guia de Pix pede o documento, mas o exemplo em PHP da mesma página envia só o e-mail. O CPF só vai em `payer.identification` quando a flag é `true`. A tela só mostra o campo nesse caso. Não entra em `customers`, em `bookings.request_hash`, em log nem no `sessionStorage`. O digest novo é o JSON sem CPF. A comparação também aceita o digest antigo (JSON inteiro) da mesma chave, sem regravá-lo.

## Webhook e reconciliação

Tópico `payment`. Manifesto `id:{data.id};request-id:{x-request-id};ts:{ts};` e frescor de ±300s (o `ts` em segundos ou milissegundos). Depois da assinatura, `GET /v1/payments/{id}` com o token resolvido e `PAYMENT_PROVIDER_TIMEOUT_MS`. O Mercado Pago espera HTTP 200 ou 201 em até 22 segundos; sem isso reenvia a notificação (https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks). O estorno tardio corre depois do commit, fora do lock. Se o gateway não responde, o webhook ainda devolve 200 com `late_no_slot` gravado e o reconciliador conclui. Timeout da consulta do pagamento, antes de gravar, responde 503, sem escrita, para o gateway tentar de novo.

`findChargeByReference` lê `provider_charge_references` (e `payments.external_id`) e, se faltar, `GET /v1/payments/search`.

`/api/cron/reconcile` consulta `/v1/payments`, retoma a devolução `late_no_slot` que o webhook ou o GET não concluiu (timeout deixa `requested` e a mesma chave), e promove `refundStatus: in_process` para `refunded` quando o gateway confirma. Não estorna por nenhum outro motivo. Toda chamada HTTP ao Mercado Pago usa `PAYMENT_PROVIDER_TIMEOUT_MS` (padrão 8s). E-mail ao dono só depois do commit. O agendador externo que chama `POST /api/cron/reconcile` com `Authorization: Bearer $CRON_SECRET` continua válido. No plano Hobby o cron da Vercel segue diário. A consulta de webhook perdido só inclui cobrança `pending` ainda dentro do hold; no Hobby isso fica para o agendador externo, mais frequente que `BOOKING_HOLD_MINUTES`.

## Nome do recebedor

`getPublicBookingFacts(businessId?: string)` em `@/lib/marketing/facts` devolve `{ holdMinutes, pixRecipientDisplayName, requiresPayerCpf }`. Sem `businessId` (landing e `GET /api/public/config`), `pixRecipientDisplayName` é `null`. Com `businessId`, o nome é o do dono e, se estiver vazio, o nome do negócio. `holdMinutes` é `BOOKING_HOLD_MINUTES`.

## Segredos

`BOOKING_ACCESS_SECRET` assina o link da reserva e o HMAC da chave de pagamento do link. `RATE_LIMIT_SECRET` assina o balde antiabuso. `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` continuam separados. Fora de produção e fora do preview da Vercel, `BOOKING_ACCESS_SECRET` vazio ainda cai em `BETTER_AUTH_SECRET`. Em produção (`NODE_ENV=production` no boot) e no `next build` com `VERCEL_ENV=production` ou `VERCEL_ENV=preview` esse fallback não existe: vazio, com menos de 32 caracteres, com prefixo de exemplo ou igual a `BETTER_AUTH_SECRET` impede o processo de subir. Production e Preview usam valores diferentes. A mensagem cita o nome e o motivo, nunca o valor.

Token novo de acompanhamento sai só com o segredo atual. O banco guarda o sha256 dele. A leitura compara esse hash em tempo constante e não consulta `BOOKING_ACCESS_SECRET_PREVIOUS`, então a rotação não invalida o link que o cliente já tem. O HMAC da chave de pagamento do link de horário é o contrário: a busca aceita o segredo atual ou `BOOKING_ACCESS_SECRET_PREVIOUS`. Sem `PREVIOUS`, o HMAC antigo não é encontrado e a mesma chave não retoma o Pix (com o claim ativo, `409 link_in_progress`).

## Rollout da 0021

Antes do merge e do deploy:

1. No Neon, crie o branch `backup-pre-0021` a partir de `production`.
2. Na Vercel, crie `BOOKING_ACCESS_SECRET` em Production e em Preview, com valores diferentes, **antes** de publicar. O link de acompanhamento que o cliente já tem continua válido sem `BOOKING_ACCESS_SECRET_PREVIOUS`. Defina `PREVIOUS` só para retomar um Pix do link de horário começado com o segredo antigo (se o segredo estava vazio, esse HMAC usava o `BETTER_AUTH_SECRET` da época). Remova `PREVIOUS` depois que esses pagamentos passarem. `PREVIOUS` precisa ter pelo menos 32 caracteres. Pode repetir `BETTER_AUTH_SECRET`; o segredo atual não pode. Se repetir o segredo atual, o boot avisa, sem o valor.
3. Rode a migration na URL direta (sem `-pooler`). A origem da URL, nesta ordem, é `env`, `.env.migrate`, `.env` ou o prompt oculto. O script imprime só essa origem, nunca o valor. Colar a URL e o Enter no prompt vale um Enter. Com terminal, a confirmação das pendentes aparece também quando a URL veio do ambiente, salvo `--yes`. Sem terminal, só `DATABASE_URL` já no ambiente segue sem `--yes`. `.env` e `.env.migrate` exigem `--yes`. Apague `.env.migrate` em seguida. CI e Docker, com `DATABASE_URL` no ambiente e sem TTY, não perguntam e não esperam input.
4. Aí sim, merge e deploy.

O passo a passo também está em `docs/CONTRATOS.md`, na seção do link de um horário.
