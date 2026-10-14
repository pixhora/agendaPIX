import { and, eq, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDb } from "../../db";
import * as schema from "../../db/schema";
import { appPublicHref, logMailFailure, sendOwnerEmail } from "../email";
import { weeklySummaryEmail } from "../email/templates/weekly-summary";

/**
 * Resumo semanal para o dono: o que o AgendaPix trouxe na semana passada (segunda a domingo,
 * no fuso do negócio) e o que já está confirmado para a semana que começa.
 * Semana sem nenhum atendimento passado nem futuro não gera e-mail.
 * Um e-mail por negócio e semana: a trava é `owner_notices(kind = weekly_summary:<segunda>)`.
 */
export type WeeklySummaryRow = {
  businessId: string;
  businessName: string;
  ownerName: string | null;
  ownerEmail: string;
  /** Segunda-feira (data local) da semana resumida. */
  weekStart: string;
  bookings: number;
  depositCents: number;
  newCustomers: number;
  nextWeekBookings: number;
};

export type WeeklySummaryMail = { to: string; subject: string; text: string; html: string };

export type WeeklySummaryPorts = {
  load: (now: Date) => Promise<WeeklySummaryRow[]>;
  claim: (businessId: string, kind: string) => Promise<boolean>;
  record: (businessId: string, kind: string) => Promise<void>;
  release: (businessId: string, kind: string) => Promise<void>;
  send: (mail: WeeklySummaryMail) => Promise<void>;
  dashboardHref: (businessId: string) => string;
};

export const weeklySummaryKind = (weekStart: string) => `weekly_summary:${weekStart}`;

export function hasActivity(row: WeeklySummaryRow) {
  return row.bookings > 0 || row.nextWeekBookings > 0;
}

export async function runWeeklySummaries(ports: WeeklySummaryPorts, now = new Date()) {
  const rows = (await ports.load(now)).filter(hasActivity);
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const kind = weeklySummaryKind(row.weekStart);
    if (!(await ports.claim(row.businessId, kind))) {
      skipped += 1;
      continue;
    }
    const mail = weeklySummaryEmail({ ...row, dashboardHref: ports.dashboardHref(row.businessId) });
    try {
      await ports.send({ to: row.ownerEmail, ...mail });
      await ports.record(row.businessId, kind);
      sent += 1;
    } catch {
      // Libera a trava: a próxima chamada do cron tenta de novo.
      logMailFailure("weekly_summary");
      await ports.release(row.businessId, kind);
      failed += 1;
    }
  }
  return { weeklySummaries: { candidates: rows.length, sent, skipped, failed } };
}

type Database = Pick<NodePgDatabase<typeof schema>, "execute" | "insert" | "update" | "delete">;

export function createDrizzleWeeklySummaryPorts(
  database: Database = getDb(),
  mailer: WeeklySummaryPorts["send"] = async (mail) => { await sendOwnerEmail(mail.to, mail.subject, mail.text, mail.html); },
): WeeklySummaryPorts {
  return {
    async load(now) {
      // Semana passada no fuso de cada negócio: date_trunc('week') devolve a segunda local.
      const result = await database.execute<{
        business_id: string; business_name: string; owner_name: string | null; owner_email: string;
        week_start: string; bookings: string; deposit_cents: string; new_customers: string; next_week_bookings: string;
      }>(sql`
        with base as (
          select b.id, b.name, b.timezone, u.email, u.name as owner_name,
                 date_trunc('week', ${now.toISOString()}::timestamptz at time zone b.timezone) - interval '7 days' as week_local
          from businesses b
          join "user" u on u.id = b.owner_id
          where u.email_verified
        ), bounds as (
          select base.*,
                 week_local at time zone base.timezone as week_from,
                 (week_local + interval '7 days') at time zone base.timezone as week_to,
                 (week_local + interval '14 days') at time zone base.timezone as next_to
          from base
        )
        select bounds.id as business_id, bounds.name as business_name, bounds.owner_name, bounds.email as owner_email,
               to_char(bounds.week_local, 'YYYY-MM-DD') as week_start,
               (select count(*) from bookings k
                 where k.business_id = bounds.id and k.status in ('confirmed', 'completed')
                   and k.starts_at >= bounds.week_from and k.starts_at < bounds.week_to) as bookings,
               (select coalesce(sum(k.deposit_cents), 0) from bookings k
                 where k.business_id = bounds.id and k.status in ('confirmed', 'completed') and k.deposit_reversed_at is null
                   and k.starts_at >= bounds.week_from and k.starts_at < bounds.week_to) as deposit_cents,
               (select count(*) from customers c
                 where c.business_id = bounds.id and c.created_at >= bounds.week_from and c.created_at < bounds.week_to) as new_customers,
               (select count(*) from bookings k
                 where k.business_id = bounds.id and k.status = 'confirmed'
                   and k.starts_at >= bounds.week_to and k.starts_at < bounds.next_to) as next_week_bookings
        from bounds
      `);
      return result.rows.map((row) => ({
        businessId: row.business_id,
        businessName: row.business_name,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        weekStart: row.week_start,
        bookings: Number(row.bookings),
        depositCents: Number(row.deposit_cents),
        newCustomers: Number(row.new_customers),
        nextWeekBookings: Number(row.next_week_bookings),
      }));
    },
    async claim(businessId, kind) {
      const rows = await database.insert(schema.ownerNotices).values({ businessId, kind }).onConflictDoNothing({
        target: [schema.ownerNotices.businessId, schema.ownerNotices.kind],
        where: sql`${schema.ownerNotices.bookingId} IS NULL`,
      }).returning({ businessId: schema.ownerNotices.businessId });
      return rows.length === 1;
    },
    async record(businessId, kind) {
      await database.update(schema.ownerNotices).set({ emailSentAt: new Date() }).where(and(
        eq(schema.ownerNotices.businessId, businessId), eq(schema.ownerNotices.kind, kind), isNull(schema.ownerNotices.bookingId),
      ));
    },
    async release(businessId, kind) {
      await database.delete(schema.ownerNotices).where(and(
        eq(schema.ownerNotices.businessId, businessId), eq(schema.ownerNotices.kind, kind),
        isNull(schema.ownerNotices.bookingId), isNull(schema.ownerNotices.emailSentAt),
      ));
    },
    send: mailer,
    dashboardHref: (businessId) => appPublicHref(`/dashboard?businessId=${encodeURIComponent(businessId)}`),
  };
}
