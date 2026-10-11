# Exclusão de conta (runbook manual)

**Não rode nada disto sem ordem escrita do Matiss.** Não há botão de exclusão no painel. O pedido é manual.

Os prazos publicados estão nos Termos (seção 12) e na Política de Privacidade (seções 8 e 10):

- o pedido sai do e-mail da própria conta e é atendido em até 10 dias depois da confirmação;
- dados da conta, do negócio, dos agendamentos e dos clientes ficam até 90 dias depois do fim da conta;
- pagamentos, devoluções, auditoria de pagamento e o registro do aceite do Mercado Pago (inclui IP) ficam 5 anos;
- sessão fica 6 meses; este runbook apaga a sessão na hora porque a conta deixa de entrar.

Nomes de tabela e coluna abaixo são os de `db/schema/index.ts` e `db/schema/auth.ts`. Não invente tabela.

## 1. Confirmar que o pedido é da conta

O pedido só vale se vier do e-mail gravado em `"user".email` do dono (`businesses.owner_id`).

1. Ache a conta pelo e-mail que escreveu. Se não for exatamente `"user".email`, pare e responda pedindo o pedido a partir desse endereço.
2. Envie um código ou um link **só para esse e-mail**. Não aceite confirmação por WhatsApp, por outro e-mail ou por telefone.
3. A confirmação é a resposta **desse mesmo endereço** com o código, ou o uso do link dentro do prazo que você marcou no e-mail (no máximo 48 horas).
4. Sem essa confirmação, não apague nem anonimize nada.
5. Anote as datas no registro manual da seção 2. O prazo de 10 dias conta da confirmação (`confirmado_em`), não do primeiro e-mail.

## 2. Registro manual do prazo

Não há tabela no banco para este pedido. Copie o quadro para o documento interno do Matiss (uma linha por pedido).

| Campo | O que anotar |
|---|---|
| `pedido_em` | Data e hora em que o e-mail da conta chegou |
| `email_da_conta` | `"user".email` conferido, não o e-mail de outra pessoa |
| `user_id` | `"user".id` |
| `business_id` | `businesses.id` |
| `confirmado_em` | Data e hora da resposta com o código ou do uso do link |
| `executado_em` | Data e hora em que o SQL abaixo fez commit |
| `executado_por` | Nome de quem rodou, com ordem do Matiss |
| `dentro_de_10_dias` | sim, se `executado_em` ≤ `confirmado_em` + 10 dias |

Checklist antes do SQL:

- [ ] Ordem escrita do Matiss
- [ ] E-mail do pedido é `"user".email`
- [ ] Código ou link enviado a esse e-mail e respondido de lá
- [ ] `confirmado_em` preenchido
- [ ] Leitura da seção 3 feita e colada no registro
- [ ] `logo_url` copiada no registro, se não for nula
- [ ] Nenhum pagamento `pending` em aberto, ou o cancelamento remoto já foi tentado

## 3. Leitura, sem gravar

Rode primeiro, fora de transação de escrita. Confira se o e-mail, o dono e o negócio são o pedido. Se a linha não vier, pare.

```sql
SELECT u.id AS user_id, u.email, u.name AS user_name,
       b.id AS business_id, b.name AS business_name, b.slug, b.logo_url, b.contact_whatsapp
FROM businesses b
JOIN "user" u ON u.id = b.owner_id
WHERE u.email = :email;
```

Substitua `:email` e, nas queries seguintes, `:business_id` e `:user_id` pelos valores lidos. Não siga se houver mais de um negócio e o pedido não disser qual.

```sql
SELECT
  (SELECT count(*) FROM customers WHERE business_id = :business_id) AS customers,
  (SELECT count(*) FROM bookings WHERE business_id = :business_id) AS bookings,
  (SELECT count(*) FROM payments WHERE business_id = :business_id) AS payments,
  (SELECT count(*) FROM payments WHERE business_id = :business_id AND status = 'pending') AS payments_pending,
  (SELECT count(*) FROM payment_refunds WHERE business_id = :business_id) AS refunds,
  (SELECT count(*) FROM payment_audit WHERE business_id = :business_id) AS payment_audit,
  (SELECT count(*) FROM slot_links WHERE business_id = :business_id) AS slot_links,
  (SELECT count(*) FROM mercadopago_connections WHERE business_id = :business_id) AS mp_connections,
  (SELECT count(*) FROM mp_connection_events WHERE business_id = :business_id) AS mp_events,
  (SELECT logo_url FROM businesses WHERE id = :business_id) AS logo_url;
```

Guarde `logo_url` no registro. Ela sai do banco no passo 5; o arquivo no Blob sai no passo 4.

Tabelas deste schema que têm dado de conta, negócio ou cliente:

| Tabela | Ligação | O que fazer agora |
|---|---|---|
| `"user"` | dono | Anonimizar. A linha fica: `businesses.owner_id` é `ON DELETE RESTRICT` |
| `session` | `user_id` → `"user"` `ON DELETE CASCADE` | Apagar |
| `account` | `user_id` → `"user"` `ON DELETE CASCADE` | Apagar (tokens e senha) |
| `verification` | `identifier` = `sign-in-otp-` + e-mail em minúsculas (`signInOtpIdentifier` em `lib/onboarding/drafts.ts`), sem FK | Apagar por esse identificador, não pelo e-mail cru |
| `businesses` | `owner_id` → `"user"` | Anonimizar. A linha fica por causa dos pagamentos |
| `business_slug_history` | `business_id` `ON DELETE RESTRICT` | Apagar |
| `booking_rate_limits` | `business_id` `ON DELETE CASCADE` | Apagar |
| `business_pix_keys` | `business_id` `ON DELETE RESTRICT` | Apagar (ciphertext da chave antiga) |
| `services` | `business_id` `ON DELETE RESTRICT` | Fica até o fim dos 5 anos, junto com as reservas |
| `business_hours` | `business_id` `ON DELETE RESTRICT` | Fica até o fim dos 5 anos |
| `customers` | `business_id` `ON DELETE RESTRICT` | Anonimizar. A linha fica: `bookings` aponta para ela |
| `bookings` | `business_id` `ON DELETE RESTRICT` | Anonimizar texto e hashes de acesso. A linha fica 5 anos |
| `slot_link_bookings` | `business_id` `ON DELETE CASCADE`; FK para `slot_links` e `bookings` | Apagar |
| `slot_links` | `business_id` `ON DELETE CASCADE`; `booking_id` sem cascade | Apagar (`customer_label`) |
| `payments` | `business_id` `ON DELETE RESTRICT`; FK para `bookings` | Fica 5 anos. Apagar QR e copia-e-cola quando o status não é `pending` |
| `payment_refunds` | `business_id` `ON DELETE RESTRICT`; FK para `payments` e `bookings` | Fica 5 anos |
| `payment_audit` | `business_id` `ON DELETE RESTRICT`; FK para `payments` e `bookings` | Fica 5 anos |
| `subscriptions` | `business_id` `ON DELETE RESTRICT` | Fica até apagar o negócio |
| `subscription_requests` | `business_id` `ON DELETE RESTRICT` | Fica até apagar o negócio |
| `mercadopago_connections` | `business_id` `ON DELETE RESTRICT` | Zerar tokens. A linha fica |
| `mercadopago_oauth_states` | `business_id` `ON DELETE RESTRICT` | Apagar |
| `mp_connection_events` | `business_id` `ON DELETE RESTRICT`; coluna `ip` | Fica 5 anos (aceite da conexão) |
| `owner_notices` | `business_id` `ON DELETE RESTRICT` | Apagar |
| `onboarding_requests` | `owner_id` → `"user"` `ON DELETE RESTRICT` | Apagar |
| `onboarding_drafts` | `email`; `business_id` `ON DELETE SET NULL` | Apagar |
| `provider_charge_references` | sem `business_id`; `reference` é a chave do pagamento | Apagar só as linhas dos pagamentos deste negócio, no fim dos 5 anos |
| `payment_events` | sem `business_id` | Não apagar agora. Não tem nome, telefone nem e-mail |
| `webhook_deliveries` | sem `business_id` | Não apagar. Sem dado de cliente |
| `webhook_deliveries_legacy` | sem `business_id` | Não apagar. Arquivo de auditoria |
| `webhook_events` | sem `business_id` | Não apagar |
| `abuse_rate_limits` | HMAC, sem `business_id` | Não apagar. Não dá para achar a linha sem o segredo |

## 4. Fora do SQL: logo e Mercado Pago

Faça isto depois da leitura e antes do `COMMIT` do passo 5. Se o SQL falhar, repita o Blob com a URL guardada no registro.

**Logo.** Se `businesses.logo_url` não for nula, apague o arquivo no Vercel Blob com o mesmo `del` de `lib/business-profile/logo-store.ts` (`@vercel/blob`, token `BLOB_READ_WRITE_TOKEN`). Só apague se o path for deste negócio (`/logos/{businessId}`), a mesma regra de `isOwnLogoUrl`. Não apague outra URL.

**Mercado Pago.** Este código não chama um endpoint de revogação. A desconexão do produto é `disconnectMercadoPago` (`DELETE` em `/api/businesses/{businessId}/mercadopago`): marca `disconnected` e só zera o ciphertext quando não há Pix em aberto. Para a exclusão, peça ao dono para desconectar no painel ou revogar o aplicativo na conta Mercado Pago dele. O SQL abaixo zera `access_token_enc` e `refresh_token_enc` de qualquer forma. Não imprima esses campos. O aviso `application.deauthorized` é confirmado no código com `GET https://api.mercadopago.com/users/me`, não com um POST de revogação.

## 5. Transação de exclusão imediata

Anonimiza o que identifica a pessoa e apaga o que não precisa ficar 90 dias ou 5 anos. Não apaga `payments`, `payment_refunds`, `payment_audit`, `mp_connection_events`, `bookings` nem `customers`.

O check `payments_pending_has_qr` exige QR e copia-e-cola enquanto `status = 'pending'`. Não zere esses campos nesse status. Cancele a cobrança antes, ou deixe o QR até o status sair de `pending`.

O check `customers_phone_format` exige telefone `+` e 8 a 15 dígitos. O telefone anonimizado abaixo cabe nesse formato e é único no negócio.

O check `mercadopago_connections_tokens_match_status` aceita `disconnected` com os dois tokens nulos e `disconnected_at` preenchido.

```sql
BEGIN;

-- Conferência de novo, dentro da transação. Se vier 0 linhas, ROLLBACK.
SELECT id FROM businesses WHERE id = :business_id AND owner_id = :user_id FOR UPDATE;

DELETE FROM slot_link_bookings WHERE business_id = :business_id;
DELETE FROM slot_links WHERE business_id = :business_id;
DELETE FROM owner_notices WHERE business_id = :business_id;
DELETE FROM mercadopago_oauth_states WHERE business_id = :business_id;
DELETE FROM booking_rate_limits WHERE business_id = :business_id;
DELETE FROM business_pix_keys WHERE business_id = :business_id;
DELETE FROM business_slug_history WHERE business_id = :business_id;
DELETE FROM onboarding_requests WHERE owner_id = :user_id;
DELETE FROM onboarding_drafts WHERE business_id = :business_id OR email = :email;

UPDATE customers AS c
SET name = 'Cliente removido',
    email = NULL,
    phone = '+9' || lpad(n.seq::text, 10, '0'),
    updated_at = now()
FROM (
  SELECT id, row_number() OVER (ORDER BY id) AS seq
  FROM customers
  WHERE business_id = :business_id
) AS n
WHERE c.id = n.id AND c.business_id = :business_id;

UPDATE bookings
SET policy_text = NULL,
    policy_snapshot = NULL,
    policy_hash = NULL,
    client_hash = NULL,
    access_token_hash = NULL,
    updated_at = now()
WHERE business_id = :business_id;

UPDATE payments
SET qr_code_data_url = NULL,
    copy_paste = NULL,
    updated_at = now()
WHERE business_id = :business_id
  AND status <> 'pending';

UPDATE mercadopago_connections
SET access_token_enc = NULL,
    refresh_token_enc = NULL,
    public_key = NULL,
    account_display_name = NULL,
    account_email_masked = NULL,
    status = 'disconnected',
    disconnected_at = COALESCE(disconnected_at, now()),
    updated_at = now()
WHERE business_id = :business_id;

UPDATE businesses
SET name = 'Negocio encerrado',
    slug = 'encerrado-' || substr(replace(id::text, '-', ''), 1, 12),
    contact_whatsapp = NULL,
    logo_url = NULL,
    updated_at = now()
WHERE id = :business_id;

DELETE FROM session WHERE user_id = :user_id;
DELETE FROM account WHERE user_id = :user_id;
DELETE FROM verification WHERE identifier = 'sign-in-otp-' || lower(trim(:email));

UPDATE "user"
SET name = 'Conta encerrada',
    email = 'encerrada-' || id || '@excluida.invalid',
    image = NULL,
    email_verified = false,
    updated_at = now()
WHERE id = :user_id;

COMMIT;
```

Preencha `executado_em` e `executado_por` depois do `COMMIT`.

O slug novo obedece `businesses_slug_format` (`encerrado-` + 12 caracteres hex). O negócio some da página pública. Quem tinha o slug antigo não acha `business_slug_history`, porque essa tabela foi apagada.

## 6. O que fica, e a ordem para apagar depois

Até 90 dias depois de `executado_em`, as linhas anonimizadas de `"user"`, `businesses`, `customers` e `bookings` continuam. Serviços e horários continuam porque a reserva aponta para o serviço (`bookings_service_tenant_fk`, sem cascade).

Cinco anos depois de `executado_em`, apague o que sobrou nesta ordem (as FKs são `RESTRICT` ou `NO ACTION`):

```sql
BEGIN;
DELETE FROM payment_audit WHERE business_id = :business_id;
DELETE FROM payment_refunds WHERE business_id = :business_id;
DELETE FROM provider_charge_references
WHERE reference IN (SELECT idempotency_key::text FROM payments WHERE business_id = :business_id);
DELETE FROM payments WHERE business_id = :business_id;
DELETE FROM bookings WHERE business_id = :business_id;
DELETE FROM customers WHERE business_id = :business_id;
DELETE FROM mp_connection_events WHERE business_id = :business_id;
DELETE FROM mercadopago_connections WHERE business_id = :business_id;
DELETE FROM subscription_requests WHERE business_id = :business_id;
DELETE FROM subscriptions WHERE business_id = :business_id;
DELETE FROM services WHERE business_id = :business_id;
DELETE FROM business_hours WHERE business_id = :business_id;
DELETE FROM businesses WHERE id = :business_id;
DELETE FROM "user" u
WHERE u.id = :user_id
  AND NOT EXISTS (SELECT 1 FROM businesses b WHERE b.owner_id = u.id);
COMMIT;
```

`payment_events`, `webhook_deliveries`, `webhook_deliveries_legacy`, `webhook_events` e `abuse_rate_limits` não têm `business_id`. Não entre num `DELETE` sem filtro de negócio.
