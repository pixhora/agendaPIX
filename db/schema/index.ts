import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, time, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { DepositPolicy } from "../../lib/policy/schema";
import { user } from "./auth";

export * from "./auth";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const bookingStatus = pgEnum("booking_status", ["pending_payment", "confirmed", "cancelled", "expired", "completed"]);
export const paymentStatus = pgEnum("payment_status", ["creating", "pending", "paid", "expired", "cancelled", "failed", "refunded", "refund_pending"]);
export const subscriptionStatus = pgEnum("subscription_status", ["trialing", "active", "past_due", "canceled"]);
export const latePaymentPolicies = ["refund", "rebook_if_free"] as const;

export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  // Política de pagamento tardio (webhook/reconciliação após o hold vencer): reembolso ou reabre o mesmo horário se livre.
  latePaymentPolicy: text("late_payment_policy", { enum: latePaymentPolicies }).default("refund").notNull(),
  // Fim do teste grátis. Negócios novos: fim do 7º dia local. Já existentes: now() + 7 dias nesta migration.
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).default(sql`(now() + interval '7 days')`).notNull(),
  contactWhatsapp: text("contact_whatsapp"),
  ...timestamps(),
}, (table) => [
  index("businesses_owner_idx").on(table.ownerId),
  check("businesses_name_not_empty", sql`length(trim(${table.name})) > 0`),
  check("businesses_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check("businesses_late_payment_policy_valid", sql`${table.latePaymentPolicy} IN ('refund', 'rebook_if_free')`),
  check("businesses_contact_whatsapp_format", sql`${table.contactWhatsapp} IS NULL OR ${table.contactWhatsapp} ~ '^[+][1-9][0-9]{7,14}$'`),
]);

export const pixKeyTypes = ["cpf", "cnpj", "email", "phone", "evp"] as const;

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
export const businessPixKeys = pgTable("business_pix_keys", {
  businessId: uuid("business_id").primaryKey().references(() => businesses.id, { onDelete: "restrict" }),
  type: text("type", { enum: pixKeyTypes }).notNull(),
  ciphertext: text("ciphertext").notNull(),
  nonce: text("nonce").notNull(),
  keyVersion: integer("key_version").notNull(),
  hint: text("hint").notNull(),
  ...timestamps(),
}, (table) => [
  check("business_pix_keys_cipher_valid", sql`length(${table.ciphertext}) > 0 AND length(${table.nonce}) > 0 AND ${table.keyVersion} > 0`),
  check("business_pix_keys_type_valid", sql`${table.type} IN ('cpf', 'cnpj', 'email', 'phone', 'evp')`),
]);

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  depositCents: integer("deposit_cents").notNull(),
  depositPolicy: jsonb("deposit_policy").$type<DepositPolicy>().notNull().default(sql`'{"version":1,"preset":"padrao","refundUntilHours":24,"rescheduleUntilHours":24,"maxReschedules":1,"lateCancel":"retain","noShow":"retain","creditValidityDays":60}'::jsonb`),
  active: boolean("active").default(true).notNull(),
  ...timestamps(),
}, (table) => [
  unique("services_business_id_unique").on(table.businessId, table.id),
  check("services_name_not_empty", sql`length(trim(${table.name})) > 0`),
  check("services_duration_positive", sql`${table.durationMinutes} > 0`),
  check("services_money_valid", sql`${table.priceCents} >= 0 AND ${table.depositCents} >= 0 AND ${table.depositCents} <= ${table.priceCents}`),
  check("services_deposit_policy_object", sql`jsonb_typeof(${table.depositPolicy}) = 'object'`),
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
  policySnapshot: jsonb("policy_snapshot").$type<DepositPolicy>(),
  policyText: text("policy_text"),
  refundDeadlineAt: timestamp("refund_deadline_at", { withTimezone: true }),
  rescheduleDeadlineAt: timestamp("reschedule_deadline_at", { withTimezone: true }),
  policyHash: text("policy_hash"),
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
  check("bookings_policy_hash_format", sql`${table.policyHash} IS NULL OR ${table.policyHash} ~ '^[a-f0-9]{64}$'`),
  check("bookings_policy_snapshot_pair", sql`(${table.policySnapshot} IS NULL) = (${table.policyText} IS NULL) AND (${table.policySnapshot} IS NULL) = (${table.policyHash} IS NULL)`),
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

export const subscriptionProviderIds = ["manual", "pix_platform"] as const;

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().unique().references(() => businesses.id, { onDelete: "restrict" }),
  status: subscriptionStatus("status").notNull(),
  provider: text("provider"),
  externalId: text("external_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  check("subscriptions_provider_valid", sql`${table.provider} IS NULL OR ${table.provider} IN ('manual', 'pix_platform')`),
]);

/** Pedido de ativação manual. No máximo um aberto (handled_at nulo) por negócio. */
export const subscriptionRequests = pgTable("subscription_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  handledBy: text("handled_by"),
}, (table) => [
  uniqueIndex("subscription_requests_one_open_per_business_idx").on(table.businessId).where(sql`${table.handledAt} IS NULL`),
  check("subscription_requests_provider_valid", sql`${table.provider} IN ('manual', 'pix_platform')`),
  check("subscription_requests_handled_pair", sql`(${table.handledAt} IS NULL) = (${table.handledBy} IS NULL)`),
  check("subscription_requests_handled_by_not_blank", sql`${table.handledBy} IS NULL OR length(trim(${table.handledBy})) > 0`),
]);

export const onboardingRequests = pgTable("onboarding_requests", {
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  requestKey: uuid("request_key").notNull(),
  requestHash: text("request_hash").notNull(),
  result: jsonb("result").$type<{ businessId: string; slug: string; publicPath: string; serviceId: string }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.ownerId, table.requestKey] })]);
