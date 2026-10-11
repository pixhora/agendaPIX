import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { manualRefundDueAtFromNotice } from "../../lib/payments/manual-refund-calendar";
import { dailyNoticeState, runManualRefundReminders, selectDaily, selectEve, type ReminderCase, type ReminderPorts } from "../../lib/payments/manual-refund-reminders";

const tz = "America/Sao_Paulo";
const noticeAt = new Date("2026-10-17T02:50:00.000Z");
const dueAt = manualRefundDueAtFromNotice(noticeAt, tz);

function item(overrides: Partial<ReminderCase> = {}): ReminderCase {
  return {
    paymentId: "pay-1",
    businessId: "biz-1",
    bookingId: "book-1",
    ownerEmail: "dono@example.com",
    ownerName: "Marina",
    timezone: tz,
    kind: "auto_failed",
    dueAt,
    reminderSentAt: null,
    noticeAt,
    firstAttemptAt: noticeAt,
    startsAt: new Date("2026-10-16T18:30:00.000Z"),
    paidAt: new Date("2026-10-16T18:34:00.000Z"),
    requestedOn: null,
    reminderCount: 0,
    lastRemindedOn: null,
    open: true,
    customerName: "Ana Souza",
    serviceName: "Design de sobrancelha",
    amountCents: 2000,
    slotOccupied: false,
    disconnected: false,
    ...overrides,
  };
}

describe("lembretes da devolução manual", () => {
  it("E5 sai na primeira passagem da véspera, inclusive no cron das 03:00 BRT, e não no dia do prazo", () => {
    const row = item();
    // 21:00 BRT do dia anterior: ainda não é a véspera.
    expect(selectEve([row], new Date("2026-10-22T00:00:00.000Z"))).toHaveLength(0);
    // 00:00 BRT da véspera: primeira passagem de um cron a cada poucos minutos.
    expect(selectEve([row], new Date("2026-10-22T03:00:00.000Z"))).toHaveLength(1);
    // 03:00 BRT: `0 6 * * *` UTC. O Hobby pode disparar até 06:59 UTC (03:59 BRT).
    expect(selectEve([row], new Date("2026-10-22T06:00:00.000Z"))).toHaveLength(1);
    expect(selectEve([row], new Date("2026-10-22T06:59:00.000Z"))).toHaveLength(1);
    // 08:59 BRT ficava de fora quando a janela começava às 09:00.
    expect(selectEve([row], new Date("2026-10-22T11:59:00.000Z"))).toHaveLength(1);
    expect(selectEve([row], new Date("2026-10-22T12:00:00.000Z"))).toHaveLength(1);
    expect(selectEve([row], new Date("2026-10-23T06:00:00.000Z"))).toHaveLength(0);
    expect(selectEve([row], new Date("2026-10-23T12:00:00.000Z"))).toHaveLength(0);
    expect(selectEve([item({ reminderSentAt: new Date("2026-10-22T06:00:00.000Z") })], new Date("2026-10-22T12:00:00.000Z"))).toHaveLength(0);
    expect(selectEve([item({ open: false })], new Date("2026-10-22T06:00:00.000Z"))).toHaveLength(0);
  });

  it("não manda E5 da política se a primeira tentativa foi no D+6 ou depois", () => {
    const late = item({
      kind: "policy",
      requestedOn: "2026-10-16",
      firstAttemptAt: new Date("2026-10-22T12:00:00.000Z"),
    });
    expect(selectEve([late], new Date("2026-10-22T12:00:00.000Z"))).toHaveLength(0);
    const early = item({
      kind: "policy",
      requestedOn: "2026-10-16",
      firstAttemptAt: new Date("2026-10-21T15:00:00.000Z"),
    });
    expect(selectEve([early], new Date("2026-10-22T12:00:00.000Z"))).toHaveLength(1);
  });

  it("E4 só em D+1 e D+2, E2 uma vez, e no dia do E5 sai só o E5", () => {
    const failed = item();
    const day1 = new Date("2026-10-17T12:00:00.000Z");
    const day2 = new Date("2026-10-18T12:00:00.000Z");
    const day3 = new Date("2026-10-19T12:00:00.000Z");
    expect(selectDaily([failed], day1, new Set())).toHaveLength(1);
    expect(selectDaily([failed], new Date("2026-10-17T06:00:00.000Z"), new Set())).toHaveLength(1);
    expect(selectDaily([item({ reminderCount: 1, lastRemindedOn: "2026-10-17" })], day1, new Set())).toHaveLength(0);
    expect(selectDaily([item({ reminderCount: 1, lastRemindedOn: "2026-10-17" })], day2, new Set())).toHaveLength(1);
    expect(selectDaily([item({ reminderCount: 2 })], day2, new Set())).toHaveLength(0);
    expect(selectDaily([failed], day3, new Set())).toHaveLength(0);
    const eve = new Date("2026-10-22T12:00:00.000Z");
    expect(selectDaily([failed], eve, new Set(["pay-1"]))).toHaveLength(0);

    const review = item({
      kind: "review",
      noticeAt: new Date("2026-10-16T15:00:00.000Z"),
      startsAt: new Date("2026-10-20T18:00:00.000Z"),
    });
    expect(selectDaily([review], new Date("2026-10-17T14:00:00.000Z"), new Set())).toHaveLength(0);
    expect(selectDaily([review], new Date("2026-10-17T15:00:00.000Z"), new Set())).toHaveLength(1);
    expect(selectDaily([item({ ...review, reminderCount: 1 })], new Date("2026-10-18T15:00:00.000Z"), new Set())).toHaveLength(0);
  });

  it("o cron das 03:00 BRT envia uma vez; outra passagem no mesmo dia não repete", async () => {
    let sentAt: Date | null = null;
    const sent: string[] = [];
    const ports: ReminderPorts = {
      async load() { return [item({ reminderSentAt: sentAt })]; },
      async claimEve() {
        if (sentAt) return false;
        sentAt = new Date();
        return true;
      },
      async releaseEve() { sentAt = null; },
      async send(mail) { sent.push(mail.to); },
      async recordEve(_item, at) { sentAt = at; },
      async recordDaily() {},
    };
    expect(await runManualRefundReminders(ports, new Date("2026-10-22T06:00:00.000Z"))).toEqual({ emails: 1 });
    expect(await runManualRefundReminders(ports, new Date("2026-10-22T12:05:00.000Z"))).toEqual({ emails: 0 });
    expect(sent).toEqual(["dono@example.com"]);
  });

  it("falha de envio solta a trava da véspera e registra o log sem o endereço", async () => {
    let released = false;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const ports: ReminderPorts = {
      async load() { return [item()]; },
      async claimEve() { return true; },
      async releaseEve() { released = true; },
      async send(mail) { throw new Error(`smtp down ${mail.to}`); },
      async recordEve() { throw new Error("não deveria gravar"); },
      async recordDaily() {},
    };
    expect(await runManualRefundReminders(ports, new Date("2026-10-22T06:00:00.000Z"))).toEqual({ emails: 0 });
    expect(released).toBe(true);
    const logged = errorLog.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(logged).toContain("[mail] scope=refund_deadline_eve code=send_failed");
    expect(logged).not.toContain("dono@example.com");
    expect(logged).not.toContain("Ana Souza");
    errorLog.mockRestore();
  });

  it("dois jobs ao mesmo tempo enviam um e-mail, só para o dono", async () => {
    const claimed = new Set<string>();
    let gate: Promise<void> = Promise.resolve();
    const sent: { to: string; text: string }[] = [];
    const ports: ReminderPorts = {
      async load() { return [item()]; },
      async claimEve(paymentId) {
        const previous = gate;
        let release = () => {};
        gate = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try {
          if (claimed.has(paymentId)) return false;
          claimed.add(paymentId);
          return true;
        } finally { release(); }
      },
      async releaseEve() {},
      async send(mail) { sent.push({ to: mail.to, text: mail.text }); },
      async recordEve() {},
      async recordDaily() {},
    };
    const now = new Date("2026-10-22T12:00:00.000Z");
    vi.stubEnv("BETTER_AUTH_URL", "https://agendapix.example");
    try {
      await Promise.all([runManualRefundReminders(ports, now), runManualRefundReminders(ports, now)]);
    } finally {
      vi.unstubAllEnvs();
    }
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("dono@example.com");
    expect(sent[0]?.text).not.toContain("cliente@");
    expect(sent[0]?.text).toContain("Abrir agenda: https://agendapix.example/dashboard?businessId=biz-1&date=2026-10-16");
    expect(sent[0]?.text).not.toContain("/dashboard/agenda/");
    expect(sent[0]?.text).not.toContain("Tentar de novo");
    expect(sent[0]?.text).not.toContain("Devolvi pelo Mercado Pago");
    expect(sent[0]?.text).not.toContain("Confirmar agendamento");
  });

  it("a trava do E5 está no UPDATE … RETURNING", () => {
    const source = readFileSync("lib/payments/manual-refund-reminders.ts", "utf8");
    expect(source).toContain("manual_refund_reminder_sent_at is null");
    expect(source).toContain("returning id");
    expect(source).toContain('kind: "refund_deadline_eve"');
    expect(source).not.toContain("refundCharge");
    expect(source).not.toContain("ownerNotices.id");
  });

  it("o lembrete diário conta 2 quando o e-mail cai no D+2", () => {
    expect(dailyNoticeState(null, tz, noticeAt)).toEqual({ reminderCount: 0, lastRemindedOn: null });
    expect(dailyNoticeState(new Date("2026-10-17T15:00:00.000Z"), tz, noticeAt)).toEqual({ reminderCount: 1, lastRemindedOn: "2026-10-17" });
    expect(dailyNoticeState(new Date("2026-10-18T15:00:00.000Z"), tz, noticeAt)).toEqual({ reminderCount: 2, lastRemindedOn: "2026-10-18" });
  });
});
