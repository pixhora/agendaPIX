import { describe, expect, it } from "vitest";
import { friendlyTimezoneLabel } from "../../lib/dashboard/timezone-label";

describe("friendlyTimezoneLabel", () => {
  it("usa nome amigável em português para fusos brasileiros comuns", () => {
    expect(friendlyTimezoneLabel("America/Sao_Paulo")).toBe("Horário de Brasília");
    expect(friendlyTimezoneLabel("America/Manaus")).toBe("Horário do Amazonas");
    expect(friendlyTimezoneLabel("America/Rio_Branco")).toBe("Horário do Acre");
    expect(friendlyTimezoneLabel("America/Noronha")).toBe("Horário de Fernando de Noronha");
    expect(friendlyTimezoneLabel("Etc/UTC")).toBe("Horário UTC");
  });

  it("nunca devolve o ID IANA cru para America/Sao_Paulo", () => {
    const label = friendlyTimezoneLabel("America/Sao_Paulo");
    expect(label).not.toMatch(/America\//);
    expect(label).not.toContain("Sao_Paulo");
  });

  it("não devolve ID cru para fusos desconhecidos suportados pelo Intl", () => {
    const label = friendlyTimezoneLabel("Europe/Lisbon");
    expect(label).not.toBe("Europe/Lisbon");
    expect(label).not.toMatch(/\//);
  });
});
