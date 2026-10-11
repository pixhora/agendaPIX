import { describe, expect, it } from "vitest";
import { buildAppointmentIcs, escapeIcsText, foldIcsLine, type AppointmentIcsInput } from "@/lib/calendar/appointment-ics";

const base: AppointmentIcsInput = {
  serviceId: "srv-corte",
  serviceName: "Corte feminino",
  businessName: "Studio Bella",
  startsAt: "2026-10-02T18:30:00.000Z",
  durationMinutes: 60,
  now: new Date("2026-10-01T12:00:00.000Z"),
};

function physicalLines(ics: string): string[] {
  return ics.split("\r\n").filter((line) => line.length > 0);
}

function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "");
}

describe("escape de TEXT do RFC 5545", () => {
  it("escapa barra invertida, ponto-e-vírgula, vírgula e quebra de linha, e remove CR", () => {
    expect(escapeIcsText("a\\b;c,d\ne\rf")).toBe("a\\\\b\\;c\\,d\\nef");
    expect(escapeIcsText("linha\r\noutra")).toBe("linha\\noutra");
    expect(escapeIcsText("já é \\n literal")).toBe("já é \\\\n literal");
  });

  it("não deixa injeção de propriedade no meio do nome do serviço abrir linha nova", () => {
    const serviceName = `${"Corte ".repeat(20)}\r\nATTENDEE:mailto:x@y\r\nBEGIN:VALARM fim`;
    const ics = buildAppointmentIcs({
      ...base,
      serviceName,
      businessName: "Studio\r\nBEGIN:VALARM Bella",
      address: "Rua A, 10; sala 2\r\nATTENDEE:mailto:x@y",
    });

    const lines = ics.split(/\r\n|\n|\r/);
    expect(lines.filter((line) => line.startsWith("ATTENDEE"))).toEqual([]);
    expect(lines.filter((line) => line.startsWith("BEGIN:VALARM"))).toEqual([]);
    expect(ics).not.toMatch(/(^|\r|\n)ATTENDEE/);
    expect(ics).not.toMatch(/(^|\r|\n)BEGIN:VALARM/);

    const unfolded = unfold(ics);
    expect(unfolded).toContain(`${"Corte ".repeat(20)}\\nATTENDEE:mailto:x@y\\nBEGIN:VALARM fim`);
    expect(unfolded).toContain("Studio\\nBEGIN:VALARM Bella");
    expect(unfolded).toContain("Rua A\\, 10\\; sala 2\\nATTENDEE:mailto:x@y");
    expect(unfolded).not.toContain("BEGIN:VALARM\r");
  });
});

describe("fuso e duração", () => {
  it("grava DTSTART e DTEND em UTC a partir do horário e da duração, sem hora local", () => {
    const ics = buildAppointmentIcs({
      ...base,
      startsAt: "2026-10-02T15:30:00-03:00",
      durationMinutes: 90,
    });

    expect(ics).toContain("DTSTART:20261002T183000Z");
    expect(ics).toContain("DTEND:20261002T200000Z");
    expect(ics).not.toContain("153000");
    expect(ics).not.toContain("TZID");
    expect(ics).not.toContain("America/Sao_Paulo");
  });

  it("mantém o instante Z e soma a duração mesmo se o fim do slot for outro", () => {
    const ics = buildAppointmentIcs({
      ...base,
      startsAt: "2026-10-02T18:30:00.000Z",
      durationMinutes: 45,
    });
    expect(ics).toContain("DTSTART:20261002T183000Z");
    expect(ics).toContain("DTEND:20261002T191500Z");
    expect(ics).not.toContain("DTEND:20261002T193000Z");
  });
});

describe("dobra de linha", () => {
  it("não dobra até 75 octetos e dobra o 76º com espaço", () => {
    expect(foldIcsLine("A".repeat(75))).toBe("A".repeat(75));
    expect(foldIcsLine("A".repeat(76))).toBe(`${"A".repeat(75)}\r\n A`);
  });

  it("não corta caractere UTF-8 e cada linha física fica em até 75 octetos", () => {
    const emojiLine = `${"a".repeat(73)}😀`;
    const folded = foldIcsLine(emojiLine);
    const parts = folded.split("\r\n");
    expect(parts[0]).toBe("a".repeat(73));
    expect(parts[1]).toBe(" 😀");
    expect(folded.replace(/\r\n[ \t]/g, "")).toBe(emojiLine);

    const serviceName = "á".repeat(60);
    const ics = buildAppointmentIcs({ ...base, serviceName, address: "Rua das Flores, 100" });
    const encoder = new TextEncoder();
    for (const line of physicalLines(ics)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(ics.endsWith("\r\n")).toBe(true);

    const summary = unfold(ics).split("\r\n").find((line) => line.startsWith("SUMMARY:"));
    expect(summary).toBe(`SUMMARY:${escapeIcsText(serviceName)} · ${escapeIcsText(base.businessName)}`);
  });
});

describe("conteúdo do arquivo", () => {
  it("mantém o UID estável, muda só o DTSTAMP e não inclui link, id nem alarme", () => {
    const first = buildAppointmentIcs(base);
    const second = buildAppointmentIcs({ ...base, now: new Date("2026-12-01T08:15:00.000Z") });
    const uidOf = (ics: string) => unfold(ics).match(/^UID:(.+)$/m)?.[1];

    expect(uidOf(first)).toMatch(/^[0-9a-f]+@agendapix$/);
    expect(uidOf(first)).toBe(uidOf(second));
    expect(first).toContain("DTSTAMP:20261001T120000Z");
    expect(second).toContain("DTSTAMP:20261201T081500Z");
    expect(first).not.toContain("bk-");
    expect(first).not.toContain("token");
    expect(first).not.toMatch(/^URL:/m);
    expect(first).not.toContain("http");
    expect(first).not.toContain("BEGIN:VALARM");
    expect(unfold(first)).toContain("SUMMARY:Corte feminino · Studio Bella");
    expect(unfold(first)).not.toContain("LOCATION:");
  });

  it("inclui LOCATION só quando há endereço", () => {
    const withAddress = unfold(buildAppointmentIcs({ ...base, address: "Rua A, 10" }));
    expect(withAddress).toContain("LOCATION:Rua A\\, 10");
    expect(unfold(buildAppointmentIcs({ ...base, address: "   " }))).not.toContain("LOCATION:");
    expect(unfold(buildAppointmentIcs({ ...base, address: null }))).not.toContain("LOCATION:");
  });
});
