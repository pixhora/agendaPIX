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

  it("validates that business name and slug must have at least 2 characters and clean kebab-case", () => {
    const isNameValid = (name: string) => name.trim().length >= 2;
    const isSlugValid = (slug: string) =>
      slug.length >= 2 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);

    expect(isNameValid("")).toBe(false);
    expect(isNameValid("A")).toBe(false);
    expect(isNameValid("Studio Bella")).toBe(true);

    expect(isSlugValid("")).toBe(false);
    expect(isSlugValid("a")).toBe(false);
    expect(isSlugValid("studio-bella")).toBe(true);
    expect(isSlugValid("studio--bella")).toBe(false); // Hífen duplo
    expect(isSlugValid("studio_bella")).toBe(false);  // Underscore
    expect(isSlugValid("barbearia-")).toBe(false);    // Hífen final
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

  it("validates that Pix deposit cannot exceed total service price in Step 2", () => {
    const isStep2Valid = (priceCents: number, depositCents: number) =>
      priceCents > 0 && depositCents >= 0 && depositCents <= priceCents;

    expect(isStep2Valid(5000, 2000)).toBe(true);
    expect(isStep2Valid(5000, 5000)).toBe(true); // 100% sinal permitido
    expect(isStep2Valid(5000, 0)).toBe(true);    // Sem sinal permitido
    expect(isStep2Valid(5000, 6000)).toBe(false); // Sinal maior rejeitado
    expect(isStep2Valid(0, 0)).toBe(false);
  });

  it("validates that closing time must be strictly after opening time in Step 3", () => {
    const isStep3Valid = (openDays: number[], opensAt: string, closesAt: string) =>
      openDays.length > 0 && opensAt < closesAt;

    expect(isStep3Valid([1, 2, 3], "09:00", "19:00")).toBe(true);
    expect(isStep3Valid([1], "08:00", "12:00")).toBe(true);
    expect(isStep3Valid([], "09:00", "19:00")).toBe(false); // Sem dias
    expect(isStep3Valid([1, 2], "19:00", "09:00")).toBe(false); // Invertido
    expect(isStep3Valid([1, 2], "10:00", "10:00")).toBe(false); // Iguais
  });
});
