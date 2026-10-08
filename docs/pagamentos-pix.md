# Pix do sinal (Payments API)

A cobrança usa `POST /v1/payments` (Checkout Transparente), não Orders. O Split/marketplace do Mercado Pago documenta Checkout Pro, Checkout Transparente e Bricks. Orders online com o token OAuth do vendedor não está documentado.

Fontes:

- https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
- https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
- Estorno: https://www.mercadopago.com.br/developers/pt/reference/chargebacks/_payments_id_refunds/post
- Webhook: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks

## Token

Hoje toda chamada usa o token da plataforma. A função injetada fica pronta para o OAuth do dono:

```ts
resolveMpAccessToken(query: {
  businessId?: string;
  mpUserId?: string;
  purpose?: "settlement" | "charge";
}, env?): Promise<string>
getSellerAccessTokenForSettlement(businessId: string): Promise<string | null>
```

`charge` cria Pix e falha com `mp_account_not_connected` se o dono desconectou. `settlement` consulta e estorna; o PR de OAuth pode devolver o token retido depois da desconexão. Sem esse gancho, as duas finalidades usam o token da plataforma. O webhook usa `user_id` da notificação (`collector_id`) com `purpose: "settlement"`. `options.accessToken` substitui o resultado só naquela chamada.

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

`date_of_expiration` = fim do hold + **2 minutos** (`MERCADOPAGO_PIX_EXPIRATION_MARGIN_MINUTES`), em ISO-8601 com offset. A doc aceita de 30 minutos a 30 dias e não diz se exatamente 30 minutos passa. O `expiresAt` que a tela recebe continua sendo só `BOOKING_HOLD_MINUTES`. Pago até o hold confirma; depois disso entra no fluxo atrasado.

QR e copia-e-cola saem de `point_of_interaction.transaction_data` (`qr_code`, `qr_code_base64`, `ticket_url`) e voltam nos campos atuais: `copyPaste` e `qrCodeDataUrl`.

## Status

| Mercado Pago | Efeito |
| --- | --- |
| `approved` + `status_detail: accredited` | pago; confirma se ainda está no hold |
| `pending` / `pending_waiting_transfer` | aguardando |
| `cancelled` / `expired` | não confirma |
| `refunded` / `charged_back` | não confirma |

`status_detail` vai no `payment_audit`. Estorno total: `POST /v1/payments/{id}/refunds`, corpo `{}` (sem `amount`), `X-Idempotency-Key` = id do pagamento e `X-Render-In-Process-Refunds: true`. O token é `resolveMpAccessToken({ businessId, purpose: "settlement" })`. A única devolução automática é Pix pago fora do prazo sem horário livre (`late_no_slot`), fora da transação de confirmação. Falha do Mercado Pago vira `refundStatus: failed` e o dono tenta de novo em `POST /api/businesses/[businessId]/bookings/[bookingId]/refund`. O estorno sai do saldo do vendedor: o Split 1:1 diz que o marketplace não emite reembolso total se o vendedor não tiver fundos.

A notificação de webhook traz `type`, `action`, `user_id` e `data.id`. Não traz o status. A consulta é `GET /v1/payments/{id}` com o token do vendedor. Sem token, o AgendaPix não confirma: grava `unverifiable_seller_disconnected` e avisa o dono por e-mail. Não há tabela de aviso no painel.

Pagamento atrasado com horário livre e política `rebook_if_free` grava `confirmed` (`late_rebooked`), sem devolução. Não há repasse: o Pix cai na conta do dono. Antes de `confirmed`, o atraso não é tratado como confirmado.

## CPF

`requiresPayerCpf` vem de `MP_REQUIRES_PAYER_CPF` (padrão `false`). A referência do `POST /v1/payments` trata `payer.identification` como opcional; o guia de Pix pede o documento. Enviamos `identification` só se o cliente mandar CPF. Sem CPF, o schema aceita o pedido.

## Webhook e reconciliação

Tópico `payment`. Manifesto `id:{data.id};request-id:{x-request-id};ts:{ts};` e frescor de ±300s (o `ts` em segundos ou milissegundos). Depois da assinatura, `GET /v1/payments/{id}` com o token resolvido.

`findChargeByReference` lê `provider_charge_references` (e `payments.external_id`) e, se faltar, `GET /v1/payments/search`.

`/api/cron/reconcile` consulta `/v1/payments`, retoma a devolução automática que ficou sem resposta e promove `refundStatus: in_process` para `refunded` quando o gateway confirma. Não estorna por nenhum outro motivo. O agendador externo que chama `POST /api/cron/reconcile` com `Authorization: Bearer $CRON_SECRET` continua válido. No plano Hobby o cron da Vercel segue diário.

## Nome do recebedor

`getPublicBookingFacts(businessId?: string)` em `@/lib/marketing/facts` devolve `{ holdMinutes, pixRecipientDisplayName, requiresPayerCpf }`. Sem `businessId` (landing e `GET /api/public/config`), `pixRecipientDisplayName` é `null`. Com `businessId`, o nome é o do dono e, se estiver vazio, o nome do negócio. `holdMinutes` é `BOOKING_HOLD_MINUTES`.

## Segredos

`BOOKING_ACCESS_SECRET` assina o link da reserva. `RATE_LIMIT_SECRET` assina o balde antiabuso. `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` continuam separados. Segredo de booking vazio cai em `BETTER_AUTH_SECRET`.
