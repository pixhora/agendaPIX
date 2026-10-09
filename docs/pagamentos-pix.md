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

`date_of_expiration` = fim do hold + **2 minutos** (`MERCADOPAGO_PIX_EXPIRATION_MARGIN_MINUTES`), em ISO-8601 com offset. A doc aceita de 30 minutos a 30 dias. `BOOKING_HOLD_MINUTES` tem padrão **30** e faixa **28–43200**: 28 + 2 = 30, o mínimo do `/v1/payments`. Abaixo de 28 a reserva responde `503` `booking_unavailable`, com a mensagem `BOOKING_HOLD_MINUTES inválido`. O `expiresAt` que a tela recebe continua sendo só o hold. Pago até o hold confirma; depois disso entra no fluxo atrasado. `MP_REQUIRES_PAYER_CPF` continua com padrão `false`.

QR e copia-e-cola saem de `point_of_interaction.transaction_data` (`qr_code`, `qr_code_base64`, `ticket_url`) e voltam nos campos atuais: `copyPaste` e `qrCodeDataUrl`.

## Status

| Mercado Pago | Efeito |
| --- | --- |
| `approved` + `status_detail: accredited` | pago; confirma se ainda está no hold |
| `pending` / `pending_waiting_transfer` | aguardando |
| `cancelled` / `expired` | não confirma |
| `refunded` / `charged_back` | não confirma |

`status_detail` vai no `payment_audit`. Estorno total: `POST /v1/payments/{id}/refunds`, corpo `{}` (sem `amount`), `X-Idempotency-Key` gerada no servidor (`{paymentId}:{n}` na devolução do dono, `auto_late:{paymentId}` no atraso sem horário) e `X-Render-In-Process-Refunds: true`. O token é `resolveMpAccessToken({ businessId, purpose: "settlement" })`. A única devolução automática é Pix pago fora do prazo sem horário livre (`late_no_slot`), fora da transação de confirmação. Falha do Mercado Pago vira `refundStatus: failed` e grava `manualRefundDueAt` no fim do 7º dia local (`MANUAL_REFUND_DEADLINE_DAYS`). O aviso `unverifiable_seller_disconnected` grava o mesmo prazo. O e-mail ao dono mostra a data no fuso do negócio (ex.: "sáb, 8 jun"), sem hora de Brasília. Vencer esse prazo não estorna, não cobra e não cancela. A primeira devolução pela política, mesmo sem saldo, grava `policy_refund_requested_on` e o prazo; uma nova tentativa não muda os dois. O rótulo da marcação manual é "Devolvi pelo Mercado Pago". O estorno sai do saldo do vendedor: o Split 1:1 diz que o marketplace não emite reembolso total se o vendedor não tiver fundos.

A notificação de webhook traz `type`, `action`, `user_id` e `data.id`. Não traz o status. A consulta é `GET /v1/payments/{id}` com o token do vendedor. Sem token, o AgendaPix não confirma: grava `unverifiable_seller_disconnected` e avisa o dono por e-mail. Não há tabela de aviso no painel.

Pagamento atrasado com horário livre e política `rebook_if_free` grava `confirmed` (`late_rebooked`), sem devolução. Não há repasse: o Pix cai na conta do dono. Antes de `confirmed`, o atraso não é tratado como confirmado.

## CPF

`requiresPayerCpf` vem de `MP_REQUIRES_PAYER_CPF` (padrão `false`). A referência do `POST /v1/payments` trata `payer.identification` como opcional; o guia de Pix pede o documento. Enviamos `identification` só se o cliente mandar CPF. Sem CPF, o schema aceita o pedido.

## Webhook e reconciliação

Tópico `payment`. Manifesto `id:{data.id};request-id:{x-request-id};ts:{ts};` e frescor de ±300s (o `ts` em segundos ou milissegundos). Depois da assinatura, `GET /v1/payments/{id}` com o token resolvido.

`findChargeByReference` lê `provider_charge_references` (e `payments.external_id`) e, se faltar, `GET /v1/payments/search`.

`/api/cron/reconcile` consulta `/v1/payments`, retoma a devolução automática que ficou sem resposta e promove `refundStatus: in_process` para `refunded` quando o gateway confirma. Não estorna por nenhum outro motivo. O agendador externo que chama `POST /api/cron/reconcile` com `Authorization: Bearer $CRON_SECRET` continua válido. No plano Hobby o cron da Vercel segue diário. A consulta de webhook perdido só inclui cobrança `pending` ainda dentro do hold; no Hobby isso fica para o agendador externo, mais frequente que `BOOKING_HOLD_MINUTES`.

## Nome do recebedor

`getPublicBookingFacts(businessId?: string)` em `@/lib/marketing/facts` devolve `{ holdMinutes, pixRecipientDisplayName, requiresPayerCpf }`. Sem `businessId` (landing e `GET /api/public/config`), `pixRecipientDisplayName` é `null`. Com `businessId`, o nome é o do dono e, se estiver vazio, o nome do negócio. `holdMinutes` é `BOOKING_HOLD_MINUTES`.

## Segredos

`BOOKING_ACCESS_SECRET` assina o link da reserva. `RATE_LIMIT_SECRET` assina o balde antiabuso. `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` continuam separados. Segredo de booking vazio cai em `BETTER_AUTH_SECRET`.
