import type { SlotLinkStatus } from "@/lib/contracts/slot-link";

function reais(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function clock(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(iso));
}

export const SLOT_LINK_STATUS_LABEL: Record<SlotLinkStatus, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago, horário confirmado",
  expired: "Expirado",
  taken: "Horário ocupado por outra reserva",
  cancelled: "Cancelado pelo dono",
};

export const OWNER_SLOT_TAKEN = "Esse horário acabou de ser ocupado. Escolha outro.";
export const OWNER_NETWORK = "Não deu para gerar agora. Tente de novo.";
export const OWNER_MP = "Conecte o Mercado Pago para cobrar sinal.";
export const OWNER_NO_DEPOSIT = "Para mandar um link, ative o sinal no Pix em pelo menos um serviço.";
export const OWNER_NO_SLOTS = "Nenhum horário livre nesse dia. Escolha outra data.";
export const OWNER_HOLD_HINT = "O horário só fica reservado quando a cliente pagar o sinal.";
export const LINK_COPIED = "Link copiado.";
export const MESSAGE_COPIED = "Mensagem copiada.";

export const CUSTOMER_EXPIRED_TITLE = "Este link expirou.";
export const CUSTOMER_TAKEN_TITLE = "Esse horário acabou de ser reservado.";
export const CUSTOMER_TAKEN_BODY = "Escolha outro horário na agenda da loja.";
export const CUSTOMER_USED_TITLE = "Este horário já foi confirmado.";
export const CUSTOMER_USED_HINT = "Se foi você, confira a mensagem de confirmação.";
export const CUSTOMER_GENERIC = "Não deu para continuar agora. Tente de novo.";
export const CUSTOMER_UNAVAILABLE_TITLE = "Este link não está mais disponível.";
export const CUSTOMER_OFFLINE = "Sem conexão. Verifique sua internet e tente de novo.";
export const CUSTOMER_MP = "Esta loja não está recebendo sinal agora. Fale com a loja.";
export const CUSTOMER_IN_PROGRESS = "Alguém está pagando este horário agora. Se o pagamento não for concluído, ele volta a ficar disponível em alguns minutos.";
export const CUSTOMER_CONFLICT_TITLE = "Você já começou o pagamento deste horário com outros dados.";
export const CUSTOMER_CONFLICT_BODY = "Para corrigir nome ou WhatsApp, fale com a loja depois de pagar.";
export const CONTINUE_PAYMENT = "Continuar pagamento";
export const SEE_SLOTS = "Ver horários disponíveis";
export const TALK_TO_STORE = "Falar com a loja";
export const TRY_AGAIN = "Tentar de novo";
export const POLICY_CHECK = "Li e concordo com a política";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDayMonth(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function weekdayShort(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return label.replace(".", "");
}

export function weekdayLong(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return label.replace(".", "");
}

/** "Corte feminino · sáb, 18/10 às 11:30 · Sinal R$ 40,00 no Pix" */
export function ownerSummary(input: { serviceName: string; date: string; time: string; depositCents: number }) {
  return `${input.serviceName} · ${weekdayShort(input.date)}, ${formatDayMonth(input.date)} às ${input.time} · Sinal ${reais(input.depositCents)} no Pix`;
}

export function slotLinkMessage(input: {
  customerLabel?: string | null;
  serviceName: string;
  date: string;
  time: string;
  depositCents: number;
  url: string;
}) {
  const name = input.customerLabel?.trim();
  const greeting = name ? `Oi, ${name}!` : "Oi!";
  return `${greeting} Separei este horário pra você: ${input.serviceName}, ${formatDayMonth(input.date)} às ${input.time}. Para confirmar, é só pagar o sinal de ${reais(input.depositCents)} no Pix por este link: ${input.url}`;
}

/** "Vale até 18/10 às 11:30 ou até alguém ocupar o horário." */
export function validityLine(expiresAt: string, timezone: string) {
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: timezone }).format(new Date(expiresAt));
  return `Vale até ${day} às ${clock(expiresAt, timezone)} ou até alguém ocupar o horário.`;
}

export function payButtonLabel(depositCents: number) {
  return `Pagar sinal de ${reais(depositCents)}`;
}

export function expiredBody(businessName: string | null) {
  const store = businessName?.trim() || "a loja";
  return `Peça um novo para ${store} ou escolha outro horário.`;
}

export function localDateParts(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: read("weekday"),
    day: read("day"),
    month: read("month"),
    time: `${read("hour")}:${read("minute")}`,
  };
}

export function clockInZone(iso: string, timezone: string) {
  return localDateParts(iso, timezone).time;
}

export function isoDateInZone(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}
