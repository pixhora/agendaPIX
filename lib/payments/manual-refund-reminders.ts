import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { appPublicHref, logMailFailure, sendOwnerEmail } from "../email";
import { refundDeadlineEveNotice, type EveKind } from "../email/templates/refund-deadline-eve";
import { MP_MANUAL_REFUND_CHANNEL } from "../mercadopago/connect-copy";
import { formatAppointment } from "./notices";
import {
  addCalendarDays,
  formatBusinessDate,
  formatBusinessDateTime,
  formatBusinessDay,
  isOpenManualRefund,
  localDate,
  zonedInstant,
} from "./manual-refund-calendar";
import { isSellerDisconnected } from "./seller-account";

type Database = NodePgDatabase<typeof schema>;

export type ReminderCase = {
  paymentId: string;
  businessId: string;
  bookingId: string;
  ownerEmail: string;
  ownerName: string | null;
  timezone: string;
  kind: EveKind;
  dueAt: Date;
  reminderSentAt: Date | null;
  noticeAt: Date;
  firstAttemptAt: Date | null;
  startsAt: Date;
  paidAt: Date | null;
  requestedOn: string | null;
  reminderCount: number;
  lastRemindedOn: string | null;
  open: boolean;
  customerName: string;
  serviceName: string;
  amountCents: number;
  slotOccupied: boolean;
  disconnected: boolean;
};

export type ReminderMail = { to: string; subject: string; text: string; html: string };

export type ReminderPorts = {
  load(now: Date): Promise<ReminderCase[]>;
  claimEve(paymentId: string): Promise<boolean>;
  releaseEve(paymentId: string): Promise<void>;
  send(mail: ReminderMail): Promise<void>;
  recordEve(item: ReminderCase, sentAt: Date): Promise<void>;
  recordDaily(item: ReminderCase, today: string): Promise<void>;
};

function brl(cents: number) {
  const value = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$ ${value}`;
}

function eveDay(item: ReminderCase) {
  return addCalendarDays(localDate(item.dueAt, item.timezone), -1);
}

function eveToday(item: ReminderCase, now: Date) {
  return localDate(now, item.timezone) === eveDay(item);
}

/** A primeira tentativa no D+6, ou depois, não gera E5. O cliente não entra nesse e-mail. */
function policyAttemptTooLate(item: ReminderCase) {
  if (item.kind !== "policy" || !item.firstAttemptAt) return false;
  return localDate(item.firstAttemptAt, item.timezone) >= eveDay(item);
}

/**
 * Dia local anterior ao prazo, em qualquer hora. O cron diário (`0 6 * * *` UTC,
 * 03:00 em Brasília, com até 59 min de atraso no Hobby) cai nessa janela. Um cron
 * frequente manda na primeira passagem depois da meia-noite local. `reminderSentAt`
 * e o claim impedem o segundo e-mail.
 */
export function selectEve(items: ReminderCase[], now: Date) {
  return items.filter((item) => item.open && !item.reminderSentAt && !policyAttemptTooLate(item) && now.getTime() <= item.dueAt.getTime() && eveToday(item, now));
}

export function selectDaily(items: ReminderCase[], now: Date, eveIds: ReadonlySet<string>) {
  return items.filter((item) => {
    if (!item.open || eveIds.has(item.paymentId) || now.getTime() > item.dueAt.getTime()) return false;
    const today = localDate(now, item.timezone);
    if (item.lastRemindedOn === today || eveToday(item, now)) return false;
    if (item.kind === "review") {
      if (item.reminderCount >= 1) return false;
      const dayAfter = item.noticeAt.getTime() + 24 * 60 * 60 * 1000;
      const beforeSlot = item.startsAt.getTime() - 3 * 60 * 60 * 1000;
      return now.getTime() >= Math.min(dayAfter, beforeSlot);
    }
    if (item.kind !== "auto_failed") return false;
    if (item.reminderCount >= 2) return false;
    const origin = localDate(item.noticeAt, item.timezone);
    return today === addCalendarDays(origin, 1) || today === addCalendarDays(origin, 2);
  });
}

function dailyText(item: ReminderCase) {
  const when = formatAppointment(item.startsAt, item.timezone);
  const due = formatBusinessDay(item.dueAt, item.timezone, false);
  if (item.kind === "review") {
    return {
      subject: `Lembrete: confira o Pix de ${item.customerName}`,
      text: `O horário é ${when}. A data limite para devolver continua a mesma. ${MP_MANUAL_REFUND_CHANNEL}`,
    };
  }
  return {
    subject: `Ainda pendente: devolva ${brl(item.amountCents)} para ${item.customerName} até ${due}`,
    text: `A devolução automática continua pendente. A data limite não mudou (${due}). ${MP_MANUAL_REFUND_CHANNEL}`,
  };
}

function eveItem(item: ReminderCase) {
  const labels = {
    dueLabel: formatBusinessDay(item.dueAt, item.timezone, true),
    dueShort: formatBusinessDay(item.dueAt, item.timezone, false),
  };
  return {
    kind: item.kind,
    customerName: item.customerName,
    serviceName: item.serviceName,
    whenLabel: formatBusinessDateTime(item.startsAt, item.timezone),
    amountLabel: brl(item.amountCents),
    dueLabel: labels.dueLabel,
    dueShort: labels.dueShort,
    requestedOnLabel: item.requestedOn ? formatBusinessDate(item.requestedOn, item.timezone) : "",
    paidAtLabel: item.paidAt ? formatBusinessDateTime(item.paidAt, item.timezone) : "",
    bookingPath: appPublicHref(`/dashboard?businessId=${encodeURIComponent(item.businessId)}&date=${encodeURIComponent(localDate(item.startsAt, item.timezone))}`),
    slotOccupied: item.slotOccupied,
    disconnected: item.disconnected,
  };
}

export async function runManualRefundReminders(ports: ReminderPorts, now = new Date()) {
  const items = await ports.load(now);
  const eve = selectEve(items, now);
  const claimed: ReminderCase[] = [];
  for (const item of eve) {
    if (await ports.claimEve(item.paymentId)) claimed.push(item);
  }
  const groups = new Map<string, ReminderCase[]>();
  for (const item of claimed) {
    const key = `${item.businessId}:${item.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  let emails = 0;
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const notice = refundDeadlineEveNotice({ ownerName: first.ownerName, items: group.map(eveItem) });
    try {
      await ports.send({ to: first.ownerEmail, subject: notice.subject, text: notice.text, html: notice.html });
      for (const item of group) await ports.recordEve(item, now);
      emails += 1;
    } catch {
      logMailFailure("refund_deadline_eve");
      for (const item of group) await ports.releaseEve(item.paymentId);
    }
  }
  const eveIds = new Set(claimed.map((item) => item.paymentId));
  for (const item of selectDaily(items, now, eveIds)) {
    const text = dailyText(item);
    try {
      await ports.send({ to: item.ownerEmail, subject: text.subject, text: text.text, html: `<p>${text.text}</p>` });
      await ports.recordDaily(item, localDate(now, item.timezone));
      emails += 1;
    } catch {
      // Sem trava prévia: a próxima hora tenta de novo. Não move dinheiro.
      logMailFailure("refund_deadline_daily");
    }
  }
  return { emails };
}

function kindOf(row: { policyRefundRequestedOn: string | null; review: boolean }): EveKind {
  if (row.policyRefundRequestedOn) return "policy";
  if (row.review) return "review";
  return "auto_failed";
}

/** O D+2 gravado em `email_sent_at` conta como o segundo lembrete. Sem linha, a contagem é zero. */
export function dailyNoticeState(emailSentAt: Date | null, timezone: string, noticeAt: Date) {
  if (!emailSentAt) return { reminderCount: 0, lastRemindedOn: null as string | null };
  const lastRemindedOn = localDate(emailSentAt, timezone);
  const reminderCount = lastRemindedOn === addCalendarDays(localDate(noticeAt, timezone), 2) ? 2 : 1;
  return { reminderCount, lastRemindedOn };
}

export function createDrizzleReminderPorts(database: Database, mailer: ReminderPorts["send"] = async (mail) => {
  await sendOwnerEmail(mail.to, mail.subject, mail.text, mail.html);
}): ReminderPorts {
  return {
    async load() {
      const rows = await database.select({
        paymentId: schema.payments.id,
        businessId: schema.payments.businessId,
        bookingId: schema.payments.bookingId,
        ownerEmail: schema.user.email,
        ownerName: schema.user.name,
        timezone: schema.businesses.timezone,
        dueAt: schema.payments.manualRefundDueAt,
        reminderSentAt: schema.payments.manualRefundReminderSentAt,
        startsAt: schema.bookings.startsAt,
        paidAt: schema.payments.paidAt,
        customerName: schema.customers.name,
        serviceName: schema.services.name,
        amountCents: schema.payments.amountCents,
        refundStatus: schema.payments.refundStatus,
        paymentStatus: schema.payments.status,
        policyRefundRequestedOn: schema.payments.policyRefundRequestedOn,
        bookingStatus: schema.bookings.status,
      }).from(schema.payments)
        .innerJoin(schema.bookings, and(eq(schema.bookings.id, schema.payments.bookingId), eq(schema.bookings.businessId, schema.payments.businessId)))
        .innerJoin(schema.businesses, eq(schema.businesses.id, schema.payments.businessId))
        .innerJoin(schema.user, eq(schema.user.id, schema.businesses.ownerId))
        .innerJoin(schema.customers, and(eq(schema.customers.id, schema.bookings.customerId), eq(schema.customers.businessId, schema.bookings.businessId)))
        .innerJoin(schema.services, and(eq(schema.services.id, schema.bookings.serviceId), eq(schema.services.businessId, schema.bookings.businessId)))
        .where(isNotNull(schema.payments.manualRefundDueAt));
      const disconnectedByBusiness = new Map<string, boolean>();
      const result: ReminderCase[] = [];
      for (const row of rows) {
        if (!row.dueAt) continue;
        const audits = await database.select({ action: schema.paymentAudit.action, createdAt: schema.paymentAudit.createdAt }).from(schema.paymentAudit)
          .where(eq(schema.paymentAudit.paymentId, row.paymentId));
        const ownerMarked = audits.some((audit) => audit.action === "owner_manual_mark" || audit.action === "owner_review_refund_marked" || audit.action === "owner_review_confirmed");
        const review = audits.some((audit) => audit.action === "unverifiable_seller_disconnected") && row.bookingStatus !== "confirmed";
        const active = await database.select({ id: schema.paymentRefunds.id }).from(schema.paymentRefunds).where(and(
          eq(schema.paymentRefunds.paymentId, row.paymentId),
          inArray(schema.paymentRefunds.status, ["requested", "processing", "refunded"]),
        )).limit(1);
        const open = isOpenManualRefund({
          dueAt: row.dueAt,
          refundStatus: row.refundStatus,
          paymentStatus: row.paymentStatus,
          ownerMarked,
          activeRefund: active.length > 0,
        }) && (!review || row.bookingStatus !== "cancelled");
        const notice = audits.find((audit) => audit.action === "automatic_refund" || audit.action === "unverifiable_seller_disconnected" || audit.action === "late_no_slot_no_token" || audit.action === "owner_refund");
        const [firstAttempt] = await database.select({ createdAt: schema.paymentRefunds.createdAt }).from(schema.paymentRefunds)
          .where(eq(schema.paymentRefunds.paymentId, row.paymentId))
          .orderBy(asc(schema.paymentRefunds.createdAt))
          .limit(1);
        const requestedOn = row.policyRefundRequestedOn;
        const noticeAt = requestedOn ? zonedInstant(requestedOn, 12 * 60 * 60, row.timezone) : notice?.createdAt ?? row.dueAt;
        const [stored] = await database.select({
          emailSentAt: schema.ownerNotices.emailSentAt,
        }).from(schema.ownerNotices).where(and(
          eq(schema.ownerNotices.bookingId, row.bookingId),
          or(eq(schema.ownerNotices.kind, "auto_refund_failed"), eq(schema.ownerNotices.kind, "owner_review"), eq(schema.ownerNotices.kind, "policy_refund")),
        )).limit(1);
        const daily = dailyNoticeState(stored?.emailSentAt ?? null, row.timezone, noticeAt);
        let disconnected = disconnectedByBusiness.get(row.businessId);
        if (disconnected === undefined) {
          try { disconnected = await isSellerDisconnected(row.businessId); }
          catch { disconnected = false; }
          disconnectedByBusiness.set(row.businessId, disconnected);
        }
        result.push({
          paymentId: row.paymentId,
          businessId: row.businessId,
          bookingId: row.bookingId,
          ownerEmail: row.ownerEmail,
          ownerName: row.ownerName,
          timezone: row.timezone,
          kind: kindOf({ policyRefundRequestedOn: requestedOn, review }),
          dueAt: row.dueAt,
          reminderSentAt: row.reminderSentAt,
          noticeAt,
          firstAttemptAt: firstAttempt?.createdAt ?? notice?.createdAt ?? null,
          startsAt: row.startsAt,
          paidAt: row.paidAt,
          requestedOn,
          reminderCount: daily.reminderCount,
          lastRemindedOn: daily.lastRemindedOn,
          open,
          customerName: row.customerName,
          serviceName: row.serviceName,
          amountCents: row.amountCents,
          slotOccupied: false,
          disconnected,
        });
      }
      return result;
    },
    async claimEve(paymentId) {
      const claimed = await database.execute(sql`
        update payments
        set manual_refund_reminder_sent_at = now()
        where id = ${paymentId}
          and manual_refund_reminder_sent_at is null
          and manual_refund_due_at is not null
          and status is distinct from 'refunded'
          and (refund_status is null or refund_status = 'failed')
          and not exists (
            select 1 from payment_refunds r
            where r.payment_id = payments.id
              and r.status in ('requested', 'processing', 'refunded')
          )
          and not exists (
            select 1 from payment_audit a
            where a.payment_id = payments.id
              and a.action in ('owner_manual_mark', 'owner_review_refund_marked', 'owner_review_confirmed')
          )
        returning id
      `);
      return claimed.rows.length > 0;
    },
    async releaseEve(paymentId) {
      await database.update(schema.payments).set({ manualRefundReminderSentAt: null }).where(eq(schema.payments.id, paymentId));
    },
    send: mailer,
    async recordEve(item, sentAt) {
      await database.insert(schema.ownerNotices).values({
        businessId: item.businessId,
        bookingId: item.bookingId,
        kind: "refund_deadline_eve",
        emailSentAt: sentAt,
      });
    },
    async recordDaily(item, today) {
      const kind = item.kind === "review" ? "owner_review" : item.kind === "policy" ? "policy_refund" : "auto_refund_failed";
      const where = and(eq(schema.ownerNotices.businessId, item.businessId), eq(schema.ownerNotices.bookingId, item.bookingId), eq(schema.ownerNotices.kind, kind));
      const [existing] = await database.select({ emailSentAt: schema.ownerNotices.emailSentAt }).from(schema.ownerNotices).where(where).limit(1);
      if (!existing) {
        await database.insert(schema.ownerNotices).values({
          businessId: item.businessId, bookingId: item.bookingId, kind, emailSentAt: zonedInstant(today, 12 * 60 * 60, item.timezone),
        });
        return;
      }
      await database.update(schema.ownerNotices).set({
        emailSentAt: zonedInstant(today, 12 * 60 * 60, item.timezone),
      }).where(where);
    },
  };
}
