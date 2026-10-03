import { describe, it, expect } from "vitest";
import { slugify } from "../../components/onboarding/slug";

describe("Onboarding business slug generation", () => {
  it("normalizes and slugifies Portuguese business names with accents", () => {
    expect(slugify("Barbearia do João")).toBe("barbearia-do-joao");
    expect(slugify("Clínica de Estética & Saúde")).toBe("clinica-de-estetica-saude");
    expect(slugify("Espaço Beleza Pura")).toBe("espaco-beleza-pura");
  });

  it("handles uppercase, special characters and punctuation", () => {
    expect(slugify("STUDIO VIP (Centro)")).toBe("studio-vip-centro");
    expect(slugify("Ana Lash & Nail!")).toBe("ana-lash-nail");
    expect(slugify("Corte @ Domicílio")).toBe("corte-domicilio");
  });

  it("trims multiple hyphens and whitespace", () => {
    expect(slugify("   Barbearia    Central   ")).toBe("barbearia-central");
    expect(slugify("---Corte---Fácil---")).toBe("corte-facil");
  });
});
