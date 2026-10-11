/**
 * Arquivo .ics (RFC 5545) gerado no navegador.
 * Não leva link de acompanhamento, id da reserva nem token: o link atual só vale na mesma aba.
 */

export interface AppointmentIcsInput {
  /** Identidade estável do horário. Não é o id da reserva. */
  serviceId: string;
  serviceName: string;
  businessName: string;
  /** Instante ISO. DTSTART/DTEND saem em UTC, a partir deste horário e da duração. */
  startsAt: string;
  durationMinutes: number;
  address?: string | null;
  /** Relógio do DTSTAMP. O UID não depende dele. */
  now?: Date;
}

/**
 * TEXT do RFC 5545 §3.3.11.
 * Ordem: remove CR, escapa `\`, depois `;`, `,` e por fim a quebra de linha vira `\n`.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Dobra uma linha de conteúdo em 75 octetos, sem cortar um caractere UTF-8 no meio. */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder();
  const pieces: string[] = [];
  let start = 0;
  let budget = 75;

  while (start < bytes.length) {
    let end = Math.min(start + budget, bytes.length);
    if (end < bytes.length) {
      while (end > start && (bytes[end]! & 0xc0) === 0x80) end -= 1;
      if (end === start) {
        end = start + 1;
        while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end += 1;
      }
    }
    const slice = decoder.decode(bytes.subarray(start, end));
    pieces.push(start === 0 ? slice : ` ${slice}`);
    start = end;
    budget = 74;
  }

  return pieces.join("\r\n");
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Hash estável (cyrb53). Só hex, então o UID não reabre uma linha do calendário. */
function cyrb53(value: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

function stableUid(input: AppointmentIcsInput): string {
  const material = [input.serviceId, input.startsAt, String(input.durationMinutes)].join("\u001f");
  return `${cyrb53(material, 0)}${cyrb53(material, 1)}@agendapix`;
}

function hasAddress(address: string | null | undefined): address is string {
  return typeof address === "string" && address.trim() !== "";
}

export function buildAppointmentIcs(input: AppointmentIcsInput): string {
  const start = new Date(input.startsAt);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Horário do agendamento inválido.");
  }
  if (!Number.isFinite(input.durationMinutes)) {
    throw new Error("Duração do serviço inválida.");
  }

  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const now = input.now ?? new Date();
  const summary = `${escapeIcsText(input.serviceName)} · ${escapeIcsText(input.businessName)}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AgendaPix//Agendamento//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${stableUid(input)}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(start)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${summary}`,
  ];

  if (hasAddress(input.address)) {
    lines.push(`LOCATION:${escapeIcsText(input.address)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
