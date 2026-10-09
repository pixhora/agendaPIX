import { MP_MANUAL_REFUND_CHANNEL } from "../../mercadopago/connect-copy";
import { formatBusinessDay } from "../../payments/manual-refund-calendar";

export type EveKind = "auto_failed" | "review" | "policy";

export type EveItem = {
  kind: EveKind;
  customerName: string;
  serviceName: string;
  whenLabel: string;
  amountLabel: string;
  dueLabel: string;
  dueShort: string;
  requestedOnLabel: string;
  paidAtLabel: string;
  bookingPath: string;
  slotOccupied: boolean;
  disconnected: boolean;
};

function actionLabel() {
  return "Abrir agenda";
}

function manualUntil(item: EveItem) {
  return `Devolva até ${item.dueLabel}. ${MP_MANUAL_REFUND_CHANNEL}`;
}

function steps(item: EveItem) {
  if (item.kind === "review") {
    if (item.slotOccupied) {
      return `O horário já foi ocupado. O prazo de 7 dias para devolver vence amanhã, ${item.dueLabel}. ${manualUntil(item)}`;
    }
    return [
      "Se for manter o agendamento, ele continua na sua agenda.",
      "",
      `Se não for manter, devolva até ${item.dueLabel}. ${MP_MANUAL_REFUND_CHANNEL}`,
    ].join("\n");
  }
  return manualUntil(item);
}

function policyLead(item: EveItem) {
  return `${item.customerName} pediu para cancelar dentro da regra do sinal em ${item.requestedOnLabel}. A devolução de ${item.amountLabel} ainda está pendente, e o prazo de 7 dias para devolver termina amanhã, ${item.dueLabel}.`;
}

function frame(item: EveItem) {
  if (item.kind === "policy") {
    return [
      `Serviço: ${item.serviceName}`,
      `Horário: ${item.whenLabel} (cancelado)`,
      `Cliente: ${item.customerName}`,
      `Pedido de cancelamento: ${item.requestedOnLabel}`,
      `Valor a devolver: ${item.amountLabel}`,
      `Prazo: até ${item.dueLabel}`,
    ];
  }
  if (item.kind === "review") {
    return [
      `Serviço: ${item.serviceName}`,
      `Quando: ${item.whenLabel}`,
      `Cliente: ${item.customerName}`,
      `Sinal: ${item.amountLabel}`,
    ];
  }
  return [
    `Serviço: ${item.serviceName}`,
    `Horário: ${item.whenLabel}`,
    `Cliente: ${item.customerName}`,
    `A devolver: ${item.amountLabel}`,
    `Prazo: até ${item.dueLabel}`,
  ];
}

function preheaderFor(item: EveItem) {
  if (item.kind === "policy") {
    return `${item.customerName} pediu para cancelar dentro da regra. O prazo de 7 dias vence amanhã, ${item.dueLabel}.`;
  }
  if (item.kind === "review") {
    return `Se não for manter o agendamento, devolva os ${item.amountLabel} até amanhã, ${item.dueLabel}.`;
  }
  return `A devolução de ${item.amountLabel} ainda está pendente. O prazo de 7 dias vence amanhã, ${item.dueLabel}.`;
}

function subjectFor(items: EveItem[]) {
  const first = items[0];
  if (!first) throw new Error("E5 sem reserva.");
  const count = items.length;
  if (first.kind === "review") {
    return count > 1 ? `Prazo vence amanhã: confira ${count} Pix` : `Prazo vence amanhã: confira o Pix de ${first.customerName}`;
  }
  if (first.kind === "policy") {
    return count > 1
      ? `Prazo vence amanhã: ${count} devoluções pela política`
      : `Prazo vence amanhã: devolva ${first.amountLabel} para ${first.customerName}`;
  }
  return count > 1
    ? `Prazo vence amanhã: ${count} devoluções pendentes`
    : `Prazo vence amanhã: devolva ${first.amountLabel} para ${first.customerName}`;
}

function lead(item: EveItem) {
  if (item.kind === "policy") return policyLead(item);
  if (item.kind === "review") return `O Pix de ${item.amountLabel} de ${item.customerName} ainda está aguardando sua conferência.`;
  return `A devolução de ${item.amountLabel} para ${item.customerName} ainda está pendente. O prazo de 7 dias vence amanhã, ${item.dueLabel}.`;
}

export function refundDeadlineEveNotice(input: { ownerName: string | null; items: EveItem[] }) {
  const first = input.items[0];
  if (!first) throw new Error("E5 sem reserva.");
  const greeting = input.ownerName ? `Oi, ${input.ownerName},` : "Oi,";
  const subject = subjectFor(input.items);
  const preheader = preheaderFor(first);
  const blocks = input.items.map((item) => [
    lead(item),
    ``,
    ...frame(item),
    ``,
    steps(item),
    ``,
    item.kind === "review" ? "Este é o último lembrete sobre este pagamento." : "Este é o último lembrete sobre esta devolução.",
    ``,
    `${actionLabel()}: ${item.bookingPath}`,
  ].join("\n"));
  const text = [greeting, ``, preheader, ``, ...blocks, ``, "Você recebe este e-mail porque tem um negócio no AgendaPix."].join("\n");
  const html = `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div><p>${htmlBlocks(input.ownerName, input.items)}</p>`;
  return { subject, preheader, text, html };
}

function htmlBlocks(ownerName: string | null, items: EveItem[]) {
  const greeting = ownerName ? `Oi, ${escapeHtml(ownerName)},` : "Oi,";
  return [greeting, ...items.map(htmlItem), "Você recebe este e-mail porque tem um negócio no AgendaPix."].join("<br><br>");
}

function htmlItem(item: EveItem) {
  if (item.kind !== "policy") return escapeHtml([lead(item), ...frame(item), steps(item)].join("\n")).replaceAll("\n", "<br>");
  const requested = `<strong>${escapeHtml(item.requestedOnLabel)}</strong>`;
  const amount = `<strong>${escapeHtml(item.amountLabel)}</strong>`;
  const due = `<strong>amanhã, ${escapeHtml(item.dueLabel)}</strong>`;
  const opening = `${escapeHtml(item.customerName)} pediu para cancelar dentro da regra do sinal em ${requested}. A devolução de ${amount} ainda está pendente, e o prazo de 7 dias para devolver termina ${due}.`;
  const lines = frame(item).map((line) => escapeHtml(line)).join("<br>");
  return [opening, lines, escapeHtml(steps(item)).replaceAll("\n", "<br>"), escapeHtml("Este é o último lembrete sobre esta devolução.")].join("<br><br>");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function dueLabels(dueAt: Date, timeZone: string) {
  return {
    dueLabel: formatBusinessDay(dueAt, timeZone, true),
    dueShort: formatBusinessDay(dueAt, timeZone, false),
  };
}
