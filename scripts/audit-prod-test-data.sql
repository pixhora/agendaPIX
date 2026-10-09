-- Auditoria somente leitura de candidatos a dado de teste no Postgres de produção.
-- Não altera nada: a transação é READ ONLY e termina em ROLLBACK.
-- Não selecione access_token, refresh_token, ciphertext, nonce nem segredo.

BEGIN READ ONLY;

-- Contagem por tabela do schema atual (db/schema).
SELECT 'user' AS table_name, count(*)::bigint AS rows FROM "user"
UNION ALL SELECT 'session', count(*)::bigint FROM "session"
UNION ALL SELECT 'account', count(*)::bigint FROM "account"
UNION ALL SELECT 'verification', count(*)::bigint FROM "verification"
UNION ALL SELECT 'businesses', count(*)::bigint FROM businesses
UNION ALL SELECT 'services', count(*)::bigint FROM services
UNION ALL SELECT 'business_hours', count(*)::bigint FROM business_hours
UNION ALL SELECT 'customers', count(*)::bigint FROM customers
UNION ALL SELECT 'bookings', count(*)::bigint FROM bookings
UNION ALL SELECT 'payments', count(*)::bigint FROM payments
UNION ALL SELECT 'booking_rate_limits', count(*)::bigint FROM booking_rate_limits
UNION ALL SELECT 'business_pix_keys', count(*)::bigint FROM business_pix_keys
UNION ALL SELECT 'provider_charge_references', count(*)::bigint FROM provider_charge_references
UNION ALL SELECT 'payment_events', count(*)::bigint FROM payment_events
UNION ALL SELECT 'webhook_deliveries', count(*)::bigint FROM webhook_deliveries
UNION ALL SELECT 'webhook_deliveries_legacy', count(*)::bigint FROM webhook_deliveries_legacy
UNION ALL SELECT 'payment_audit', count(*)::bigint FROM payment_audit
UNION ALL SELECT 'payment_refunds', count(*)::bigint FROM payment_refunds
UNION ALL SELECT 'subscriptions', count(*)::bigint FROM subscriptions
UNION ALL SELECT 'subscription_requests', count(*)::bigint FROM subscription_requests
UNION ALL SELECT 'mercadopago_connections', count(*)::bigint FROM mercadopago_connections
UNION ALL SELECT 'mercadopago_oauth_states', count(*)::bigint FROM mercadopago_oauth_states
UNION ALL SELECT 'mp_connection_events', count(*)::bigint FROM mp_connection_events
UNION ALL SELECT 'owner_notices', count(*)::bigint FROM owner_notices
UNION ALL SELECT 'onboarding_requests', count(*)::bigint FROM onboarding_requests
UNION ALL SELECT 'onboarding_drafts', count(*)::bigint FROM onboarding_drafts
UNION ALL SELECT 'abuse_rate_limits', count(*)::bigint FROM abuse_rate_limits
ORDER BY table_name;

-- Donos com e-mail ou nome de teste. Sem senha e sem token de sessão.
SELECT u.id, u.name, u.email, u.email_verified, u.created_at
FROM "user" AS u
WHERE u.email ~* '@([^@[:space:]]+\.)?example\.(com|org|net)$'
   OR u.email ~* '@([^@[:space:]]+\.)?(localhost|mailpit|mailinator)(\.|$)'
   OR u.email ~* '@[^@[:space:]]+\.(test|local|localhost)$'
   OR u.email ~* '@(test|mailpit)(\.|$)'
   OR u.name ~* '(^|[^[:alnum:]])(demo|teste|test|sample|fixture)([^[:alnum:]]|$)'
ORDER BY u.created_at, u.id;

-- Negócios com slug ou nome de exemplo.
SELECT b.id, b.owner_id, b.name, b.slug, b.created_at
FROM businesses AS b
WHERE b.slug ~* '(^|-)(demo|teste|test|sample|fixture|studio-bella|barbearia-demo)(-|$)'
   OR b.name ~* '(^|[^[:alnum:]])(demo|teste|test|sample|fixture)([^[:alnum:]]|$)'
   OR b.name ~* 'studio bella|barbearia demo'
ORDER BY b.created_at, b.id;

-- Clientes (quem agenda) com e-mail de teste.
SELECT c.id, c.business_id, c.name, c.email, c.created_at
FROM customers AS c
WHERE c.email IS NOT NULL
  AND (
    c.email ~* '@([^@[:space:]]+\.)?example\.(com|org|net)$'
    OR c.email ~* '@([^@[:space:]]+\.)?(localhost|mailpit|mailinator)(\.|$)'
    OR c.email ~* '@[^@[:space:]]+\.(test|local|localhost)$'
    OR c.name ~* '(^|[^[:alnum:]])(demo|teste|test|sample|fixture)([^[:alnum:]]|$)'
  )
ORDER BY c.created_at, c.id;

-- Rascunhos de cadastro com e-mail de teste. A coluna data pode ter o nome do negócio.
SELECT d.id, d.email, d.segment, d.plan, d.business_id, d.consumed_at, d.created_at
FROM onboarding_drafts AS d
WHERE d.email ~* '@([^@[:space:]]+\.)?example\.(com|org|net)$'
   OR d.email ~* '@([^@[:space:]]+\.)?(localhost|mailpit|mailinator)(\.|$)'
   OR d.email ~* '@[^@[:space:]]+\.(test|local|localhost)$'
   OR d.data::text ~* '(demo|teste|studio bella|barbearia demo)'
ORDER BY d.created_at, d.id;

-- Cobrança fake, sem id no Mercado Pago (fora de creating) ou copia-e-cola de simulação.
-- external_id nulo em creating é o estado normal antes do gateway responder.
SELECT p.id, p.business_id, p.booking_id, p.provider, p.external_id, p.status, p.amount_cents, p.created_at
FROM payments AS p
WHERE p.provider = 'fake'
   OR p.provider ILIKE '%fake%'
   OR p.external_id ILIKE 'fake%'
   OR p.copy_paste ILIKE 'FAKE-PIX%'
   OR (p.provider = 'mercadopago' AND p.external_id IS NULL AND p.status IS DISTINCT FROM 'creating')
ORDER BY p.created_at, p.id;

-- Conta Mercado Pago em modo de teste (live_mode false). Sem token.
SELECT c.business_id, b.slug, b.name, c.status, c.live_mode, c.mp_user_id, c.connected_at, c.disconnected_at
FROM mercadopago_connections AS c
JOIN businesses AS b ON b.id = c.business_id
WHERE c.live_mode IS FALSE
ORDER BY c.connected_at, c.business_id;

-- Pagamentos desses negócios em modo de teste.
SELECT p.id, p.business_id, b.slug, p.provider, p.external_id, p.status, p.amount_cents, p.created_at
FROM payments AS p
JOIN mercadopago_connections AS c ON c.business_id = p.business_id
JOIN businesses AS b ON b.id = p.business_id
WHERE c.live_mode IS FALSE
ORDER BY p.created_at, p.id;

-- Reservas ainda pending_payment e já vencidas, ou criadas há mais de 7 dias.
SELECT k.id, k.business_id, b.slug, k.status, k.created_at, k.expires_at, k.starts_at
FROM bookings AS k
JOIN businesses AS b ON b.id = k.business_id
WHERE k.status = 'pending_payment'
  AND (
    (k.expires_at IS NOT NULL AND k.expires_at < now())
    OR k.created_at < now() - interval '7 days'
  )
ORDER BY k.created_at, k.id;

ROLLBACK;
