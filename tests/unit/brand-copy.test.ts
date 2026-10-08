import { describe, expect, it } from "vitest";
import { magicLinkEmail } from "../../lib/email";

describe("marca o AgendaPix", () => {
  it("usa o artigo masculino no e-mail de acesso", () => {
    expect(magicLinkEmail.subject).toBe("Seu link para acessar o AgendaPix");
    expect(magicLinkEmail.text("https://exemplo")).toContain("Acesse o AgendaPix pelo link abaixo.");
    expect(`${magicLinkEmail.subject} ${magicLinkEmail.text("https://exemplo")}`).not.toMatch(/\b(a|da|na|pela) AgendaPix\b/);
  });
});