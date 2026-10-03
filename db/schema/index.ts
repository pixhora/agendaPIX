import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, pgEnum, pgTable, text, time, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export * from "./auth";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const bookingStatus = pgEnum("booking_status", ["pending_payment", "confirmed", "cancelled", "expired", "completed"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "expired", "failed", "refunded"]);

export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  ...timestamps(),
}, (table) => [
  index("businesses_owner_idx").on(table.ownerId),
  check("businesses_name_not_empty", sql`length(trim(${table.name})) > 0`),
  check("businesses_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
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
  status: paymentStatus("status").default("pending").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps(),
}, (table) => [
  foreignKey({ name: "payments_booking_tenant_fk", columns: [table.businessId, table.bookingId], foreignColumns: [bookings.businessId, bookings.id] }),
  index("payments_business_booking_idx").on(table.businessId, table.bookingId),
  unique("payments_provider_external_unique").on(table.provider, table.externalId),
  check("payments_amount_positive", sql`${table.amountCents} > 0`),
  check("payments_provider_not_empty", sql`length(trim(${table.provider})) > 0`),
  check("payments_paid_timestamp_required", sql`${table.status} <> 'paid' OR ${table.paidAt} IS NOT NULL`),
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

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id"),
  bodyHash: text("body_hash"),
  outcome: text("outcome").default("received").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("webhook_deliveries_event_idx").on(table.provider, table.eventId)]);
