import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, time, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export * from "./auth";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const bookingStatus = pgEnum("booking_status", ["pending_payment", "confirmed", "cancelled", "expired", "completed"]);
export const paymentStatus = pgEnum("payment_status", ["creating", "pending", "paid", "expired", "cancelled", "failed", "refunded", "refund_pending"]);
export const latePaymentPolicies = ["refund", "rebook_if_free"] as const;

export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  // Política de pagamento tardio (webhook/reconciliação após o hold vencer): reembolso ou reabre o mesmo horário se livre.
  latePaymentPolicy: text("late_payment_policy", { enum: latePaymentPolicies }).default("refund").notNull(),
  ...timestamps(),
}, (table) => [
  index("businesses_owner_idx").on(table.ownerId),
  check("businesses_name_not_empty", sql`length(trim(${table.name})) > 0`),
  check("businesses_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check("businesses_late_payment_policy_valid", sql`${table.latePaymentPolicy} IN ('refund', 'rebook_if_free')`),
]);

export const bookingRateLimits = pgTable("booking_rate_limits", {
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  clientHash: text("client_hash").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  attempts: integer("attempts").notNull(),
}, (table) => [
  primaryKey({ columns: [table.businessId, table.clientHash] }),
  index("booking_rate_window_idx").on(table.windowStartedAt),
  check("booking_rate_attempts_valid", sql`${table.attempts} >= 1`),
]);

export const pixKeyTypes = ["cpf", "cnpj", "email", "phone", "evp"] as const;

/** Chave Pix antiga. Toda linha fica inativa; o ciphertext permanece e não entra em cobrança nem em resposta. */
export const businessPixKeys = pgTable("business_pix_keys", {
  businessId: uuid("business_id").primaryKey().references(() => businesses.id, { onDelete: "restrict" }),
  type: text("type", { enum: pixKeyTypes }).notNull(),
  ciphertext: text("ciphertext").notNull(),
  nonce: text("nonce").notNull(),
  keyVersion: integer("key_version").notNull(),
  hint: text("hint").notNull(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }).defaultNow().notNull(),
  deactivationReason: text("deactivation_reason").default("pix_key_retired").notNull(),
  ...timestamps(),
}, (table) => [
  check("business_pix_keys_cipher_valid", sql`length(${table.ciphertext}) > 0 AND length(${table.nonce}) > 0 AND ${table.keyVersion} > 0`),
  check("business_pix_keys_type_valid", sql`${table.type} IN ('cpf', 'cnpj', 'email', 'phone', 'evp')`),
  check("business_pix_keys_retired", sql`${table.deactivatedAt} IS NOT NULL AND length(trim(${table.deactivationReason})) > 0`),
]);

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  depositCents: integer("deposit_cents").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps(),
}, (table) => [
  unique("services_business_id_unique").on(table.businessId, table.id),
  check("services_name_not_empty", sql`length(trim(${table.name})) > 0`),
  check("services_duration_positive", sql`${table.durationMinutes} > 0`),
  check("services_money_valid", sql`${table.priceCents} >= 0 AND ${table.depositCents} >= 0 AND ${table.depositCents} <= ${table.priceCents}`),
]);

export const businessHours = pgTable("business_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  weekday: integer("weekday").notNull(),
  opensAt: time("opens_at").notNull(),
  closesAt: time("closes_at").notNull(),
  ...timestamps(),
}, (table) => [
  unique("business_hours_weekday_unique").on(table.businessId, table.weekday),
  check("business_hours_weekday_valid", sql`${table.weekday} BETWEEN 0 AND 6`),
  check("business_hours_interval_valid", sql`${table.opensAt} < ${table.closesAt}`),
]);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  ...timestamps(),
}, (table) => [
  unique("customers_business_id_unique").on(table.businessId, table.id),
  unique("customers_business_phone_unique").on(table.businessId, table.phone),
  check("customers_name_not_empty", sql`length(trim(${table.name})) > 0`),
  check("customers_phone_format", sql`${table.phone} ~ '^[+][1-9][0-9]{7,14}$'`),
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  serviceId: uuid("service_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  requestKey: uuid("request_key"),
  requestHash: text("request_hash"),
  accessTokenHash: text("access_token_hash"),
  // HMAC por negócio da identidade do cliente (nunca o IP bruto); usado só para limitar reservas pendentes.
  clientHash: text("client_hash"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  priceCents: integer("price_cents").notNull(),
  depositCents: integer("deposit_cents").notNull(),
  status: bookingStatus("status").default("pending_payment").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  unique("bookings_business_id_unique").on(table.businessId, table.id),
  unique("bookings_business_request_unique").on(table.businessId, table.requestKey),
  index("bookings_business_start_idx").on(table.businessId, table.startsAt),
  index("bookings_pending_hold_idx").on(table.businessId, table.expiresAt).where(sql`${table.status} = 'pending_payment'`),
  index("bookings_pending_client_idx").on(table.businessId, table.clientHash).where(sql`${table.status} = 'pending_payment'`),
  foreignKey({ name: "bookings_service_tenant_fk", columns: [table.businessId, table.serviceId], foreignColumns: [services.businessId, services.id] }),
  foreignKey({ name: "bookings_customer_tenant_fk", columns: [table.businessId, table.customerId], foreignColumns: [customers.businessId, customers.id] }),
  check("bookings_interval_valid", sql`${table.startsAt} < ${table.endsAt}`),
  check("bookings_money_valid", sql`${table.priceCents} >= 0 AND ${table.depositCents} >= 0 AND ${table.depositCents} <= ${table.priceCents}`),
  check("bookings_pending_expiry_required", sql`${table.status} <> 'pending_payment' OR (${table.expiresAt} IS NOT NULL AND ${table.expiresAt} > ${table.createdAt})`),
]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  bookingId: uuid("booking_id").notNull(),
  provider: text("provider").notNull(),
  externalId: text("external_id"),
  qrCodeDataUrl: text("qr_code_data_url"),
  copyPaste: text("copy_paste"),
  idempotencyKey: uuid("idempotency_key").notNull().unique(),
  amountCents: integer("amount_cents").notNull(),
  status: paymentStatus("status").default("creating").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps(),
}, (table) => [
  unique("payments_business_id_unique").on(table.businessId, table.id),
  foreignKey({ name: "payments_booking_tenant_fk", columns: [table.businessId, table.bookingId], foreignColumns: [bookings.businessId, bookings.id] }),
  index("payments_business_booking_idx").on(table.businessId, table.bookingId),
  index("payments_reconcile_status_idx").on(table.status, table.updatedAt),
  unique("payments_provider_external_unique").on(table.provider, table.externalId),
  check("payments_amount_positive", sql`${table.amountCents} > 0`),
  check("payments_provider_not_empty", sql`length(trim(${table.provider})) > 0`),
  check("payments_paid_timestamp_required", sql`${table.status} <> 'paid' OR ${table.paidAt} IS NOT NULL`),
  // creating: cobrando o gateway; pending: QR anexado; demais estados finais ou de auditoria.
  check("payments_creating_has_no_qr", sql`${table.status} <> 'creating' OR (${table.qrCodeDataUrl} IS NULL AND ${table.copyPaste} IS NULL AND ${table.externalId} IS NULL)`),
  check("payments_pending_has_qr", sql`${table.status} <> 'pending' OR (${table.externalId} IS NOT NULL AND ${table.qrCodeDataUrl} IS NOT NULL AND ${table.copyPaste} IS NOT NULL)`),
]);


// Mapeamento durável reference (id do pagamento local) → id da cobrança no gateway.
// Gravado logo após o gateway criar a cobrança, antes de anexar o QR ao pagamento; permite que
// findChargeByReference funcione entre instâncias serverless (o Orders API do MP não busca por external_reference).
export const providerChargeReferences = pgTable("provider_charge_references", {
  provider: text("provider").notNull(),
  reference: text("reference").notNull(),
  externalId: text("external_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: "provider_charge_references_pk", columns: [table.provider, table.reference] }),
  unique("provider_charge_references_external_unique").on(table.provider, table.externalId),
  check("provider_charge_references_not_empty", sql`length(trim(${table.reference})) > 0 AND length(trim(${table.externalId})) > 0`),
]);

// Metadados de auditoria não guardam corpo bruto, telefone, assinatura ou segredo.
export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  externalId: text("external_id").notNull(),
  payloadHash: text("payload_hash").notNull(),
  outcome: text("outcome").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("payment_events_provider_event_unique").on(table.provider, table.eventId)]);

// Somente entregas com assinatura e formato verificados; uma linha por evento do provedor (replays não gravam).
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  bodyHash: text("body_hash").notNull(),
  outcome: text("outcome").default("received").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("webhook_deliveries_provider_event_unique").on(table.provider, table.eventId)]);

// Arquivo somente leitura das entregas anteriores à verificação prévia (não verificadas ou duplicadas), preservado para auditoria.
export const webhookDeliveriesLegacy = pgTable("webhook_deliveries_legacy", {
  id: uuid("id").primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id"),
  bodyHash: text("body_hash"),
  outcome: text("outcome").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// Auditoria de decisões de pagamento (reconciliação, pagamento tardio, cancelamento no gateway). Sem PII.
export const paymentAudit = pgTable("payment_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  paymentId: uuid("payment_id").notNull(),
  bookingId: uuid("booking_id").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "payment_audit_payment_tenant_fk", columns: [table.businessId, table.paymentId], foreignColumns: [payments.businessId, payments.id] }),
  foreignKey({ name: "payment_audit_booking_tenant_fk", columns: [table.businessId, table.bookingId], foreignColumns: [bookings.businessId, bookings.id] }),
  index("payment_audit_business_created_idx").on(table.businessId, table.createdAt),
  index("payment_audit_payment_idx").on(table.paymentId),
  check("payment_audit_action_not_empty", sql`length(trim(${table.action})) > 0`),
]);

export const mpConnectionStatuses = ["connected", "needs_reconnect", "disconnected"] as const;

// Conta Mercado Pago do próprio negócio. O Pix do sinal cai na conta do vendedor; a plataforma não repassa.
// Tokens só existem cifrados. mp_user_id é único entre conexões ativas (status connected).
export const mercadopagoConnections = pgTable("mercadopago_connections", {
  businessId: uuid("business_id").primaryKey().references(() => businesses.id, { onDelete: "restrict" }),
  mpUserId: text("mp_user_id").notNull(),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  publicKey: text("public_key"),
  scope: text("scope"),
  liveMode: boolean("live_mode"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
  status: text("status", { enum: mpConnectionStatuses }).notNull(),
  lastError: text("last_error"),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
  consentVersion: text("consent_version"),
  consentTextSha256: text("consent_text_sha256"),
  autoRefundAckAt: timestamp("auto_refund_ack_at", { withTimezone: true }),
  consentUserId: text("consent_user_id"),
  accountDisplayName: text("account_display_name"),
  accountEmailMasked: text("account_email_masked"),
  ...timestamps(),
}, (table) => [
  uniqueIndex("mercadopago_connections_mp_user_connected_uq").on(table.mpUserId).where(sql`${table.status} = 'connected'`),
  index("mercadopago_connections_refresh_idx").on(table.expiresAt).where(sql`${table.status} = 'connected'`),
  check("mercadopago_connections_status_valid", sql`${table.status} IN ('connected', 'needs_reconnect', 'disconnected')`),
  check("mercadopago_connections_mp_user_not_empty", sql`length(trim(${table.mpUserId})) > 0`),
  check("mercadopago_connections_consent_hash", sql`${table.consentTextSha256} IS NULL OR ${table.consentTextSha256} ~ '^[0-9a-f]{64}$'`),
  check("mercadopago_connections_account_display_name", sql`${table.accountDisplayName} IS NULL OR char_length(${table.accountDisplayName}) BETWEEN 1 AND 80`),
  check("mercadopago_connections_account_email_masked", sql`${table.accountEmailMasked} IS NULL OR ${table.accountEmailMasked} ~ '^.{1,2}\u2022\u2022@.+$'`),
  check("mercadopago_connections_tokens_match_status", sql`(
    (${table.status} = 'connected' AND ${table.disconnectedAt} IS NULL AND ${table.accessTokenEnc} IS NOT NULL AND ${table.refreshTokenEnc} IS NOT NULL AND length(${table.accessTokenEnc}) > 0 AND length(${table.refreshTokenEnc}) > 0 AND ${table.expiresAt} IS NOT NULL)
    OR (${table.status} = 'needs_reconnect' AND ${table.accessTokenEnc} IS NULL AND ${table.refreshTokenEnc} IS NULL)
    OR (${table.status} = 'disconnected' AND ${table.disconnectedAt} IS NOT NULL AND (
      (${table.accessTokenEnc} IS NULL AND ${table.refreshTokenEnc} IS NULL)
      OR (${table.accessTokenEnc} IS NOT NULL AND ${table.refreshTokenEnc} IS NOT NULL AND length(${table.accessTokenEnc}) > 0 AND length(${table.refreshTokenEnc}) > 0)
    ))
  )`),
]);

/** State do OAuth enquanto o dono está no Mercado Pago. O verifier PKCE, quando existe, fica só no cookie. */
export const mercadopagoOauthStates = pgTable("mercadopago_oauth_states", {
  state: text("state").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  returnTo: text("return_to").notNull(),
  consentVersion: text("consent_version").notNull(),
  consentTextSha256: text("consent_text_sha256").notNull(),
  autoRefundAckAt: timestamp("auto_refund_ack_at", { withTimezone: true }).notNull(),
  consentUserId: text("consent_user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("mercadopago_oauth_states_business_idx").on(table.businessId),
  check("mercadopago_oauth_states_not_empty", sql`length(trim(${table.state})) > 0 AND length(trim(${table.consentVersion})) > 0 AND length(trim(${table.consentUserId})) > 0 AND ${table.consentTextSha256} ~ '^[0-9a-f]{64}$'`),
]);

/** Eventos da conexão. O IP do consentimento fica só aqui. */
export const mpConnectionEvents = pgTable("mp_connection_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  ip: text("ip"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("mp_connection_events_business_idx").on(table.businessId, table.createdAt),
  check("mp_connection_events_kind_not_empty", sql`length(trim(${table.kind})) > 0`),
  check("mp_connection_events_detail_safe", sql`${table.detail} IS NULL OR ${table.detail} ~ '^(timeout|unreachable|invalid_response|http_[1-5][0-9]{2})$'`),
]);

/** Aviso do dono. Sem reserva, uma linha por negócio e tipo. Com reserva, uma linha por reserva e tipo. Não guarda a chave Pix. */
export const ownerNotices = pgTable("owner_notices", {
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  bookingId: uuid("booking_id"),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("owner_notices_business_kind_uq").on(table.businessId, table.kind).where(sql`${table.bookingId} IS NULL`),
  uniqueIndex("owner_notices_booking_kind_uq").on(table.bookingId, table.kind).where(sql`${table.bookingId} IS NOT NULL`),
  check("owner_notices_kind_not_empty", sql`length(trim(${table.kind})) > 0`),
]);

export const onboardingRequests = pgTable("onboarding_requests", {
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  requestKey: uuid("request_key").notNull(),
  requestHash: text("request_hash").notNull(),
  result: jsonb("result").$type<{ businessId: string; slug: string; publicPath: string; serviceId: string }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.ownerId, table.requestKey] })]);
