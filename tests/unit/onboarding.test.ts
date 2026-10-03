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

  it("validates that business name and slug must have at least 2 characters", () => {
    const isStep1Valid = (name: string, slug: string) =>
      name.trim().length >= 2 && slug.length >= 2;

    expect(isStep1Valid("", "")).toBe(false);
    expect(isStep1Valid("A", "a")).toBe(false);
    expect(isStep1Valid("Studio Bella", "studio-bella")).toBe(true);
    expect(isStep1Valid("Barbearia", "")).toBe(false);
  });

  it("validates professional email format for login and onboarding step 4", () => {
    const isValidEmail = (email: string) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("invalido")).toBe(false);
    expect(isValidEmail("sem@dominio")).toBe(false);
    expect(isValidEmail("contato@barbearia.com.br")).toBe(true);
    expect(isValidEmail("  dono@studio.com  ")).toBe(true);
  });
});
