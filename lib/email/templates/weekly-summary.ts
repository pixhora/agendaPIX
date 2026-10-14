import { addCalendarDays } from "../../payments/manual-refund-calendar";
import { formatBrlCents } from "../../dashboard/summary";

export type WeeklySummaryInput = {
  businessName: string;
  ownerName: string | null;
  /** Segunda-feira (YYYY-MM-DD) da semana resumida. */
  weekStart: string;
  bookings: number;
  depositCents: number;
  newCustomers: number;
  nextWeekBookings: number;
  dashboardHref: string;
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function dayMonth(isoDate: string) {
  const [, month, day] = isoDate.split("-").map(Number);
  return { day, month: MONTHS[month - 1] };
}

/** "6 a 12 de outubro" ou "29 de setembro a 5 de outubro". */
export function weekLabel(weekStart: string) {
  const from = dayMonth(weekStart);
  const to = dayMonth(addCalendarDays(weekStart, 6));
  return from.month === to.month ? `${from.day} a ${to.day} de ${to.month}` : `${from.day} de ${from.month} a ${to.day} de ${to.month}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const money = (cents: number) => formatBrlCents(BigInt(cents));

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function weeklySummaryEmail(input: WeeklySummaryInput) {
  const first = input.ownerName?.trim().split(/\s+/)[0];
  const greeting = first ? `Olá, ${first}!` : "Olá!";
  const subject = input.depositCents > 0
    ? `Sua semana: ${money(input.depositCents)} em sinais pelo Pix`
    : `Sua semana no AgendaPix: ${plural(input.bookings, "atendimento", "atendimentos")}`;

  const facts = [
    plural(input.bookings, "atendimento confirmado", "atendimentos confirmados"),
    ...(input.depositCents > 0 ? [`${money(input.depositCents)} em sinais recebidos pelo Pix`] : []),
    ...(input.newCustomers > 0 ? [plural(input.newCustomers, "cliente novo", "clientes novos")] : []),
  ];
  const next = input.nextWeekBookings > 0
    ? `Semana que vem: ${plural(input.nextWeekBookings, "horário já confirmado", "horários já confirmados")}.`
    : "Semana que vem ainda está livre. Mande seu link no status do WhatsApp para encher a agenda.";
  const intro = `Resumo de ${input.businessName}, semana de ${weekLabel(input.weekStart)}:`;
  const footer = "Você recebe este e-mail porque tem um negócio no AgendaPix.";
  const preheader = `${facts[0]}${input.depositCents > 0 ? ` e ${money(input.depositCents)} em sinais` : ""}. ${next}`;

  const text = [
    greeting,
    "",
    intro,
    "",
    ...facts.map((fact) => `- ${fact}`),
    "",
    next,
    "",
    `Abrir agenda: ${input.dashboardHref}`,
    "",
    footer,
  ].join("\n");

  const html = [
    `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>`,
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<ul>${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>`,
    `<p>${escapeHtml(next)}</p>`,
    `<p><a href="${escapeHtml(input.dashboardHref)}">Abrir agenda</a></p>`,
    `<p style="color:#6b6b6b;font-size:13px">${escapeHtml(footer)}</p>`,
  ].join("");

  return { subject, preheader, text, html };
}
