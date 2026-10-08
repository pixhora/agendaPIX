import { describe, expect, it } from "vitest";
import { publicLinkHost } from "../../lib/public-host";

describe("publicLinkHost", () => {
  it("mostra o host sem protocolo", () => {
    expect(publicLinkHost("https://agendapix.dev.br", "production")).toBe("agendapix.dev.br");
    expect(publicLinkHost("https://agendapix.dev.br:8443/painel", "production")).toBe("agendapix.dev.br:8443");
    expect(publicLinkHost("http://localhost:3000", "development")).toBe("localhost:3000");
  });

  it("não mostra 127.0.0.1 em produção", () => {
    expect(publicLinkHost("http://127.0.0.1:3000", "production")).toBe("");
    expect(publicLinkHost("http://127.0.0.1:3456", "production")).toBe("");
    expect(publicLinkHost("http://[::1]:3000", "production")).toBe("");
  });
});
