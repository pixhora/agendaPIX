import { describe, expect, it, vi } from "vitest";
import { createOnboardingData } from "../../lib/onboarding/flow";
import { onboardingInputSchema } from "../../lib/onboarding/validation";
import { logoRejection, LOGO_MAX_BYTES } from "../../lib/store-profile/logo";
import { slugView } from "../../lib/store-profile/slug-ui";
import { storeSubmission, submitStore } from "../../lib/store-profile/submit";
import { OLD_SLUG_REDIRECT_READY } from "../../lib/store-profile/redirect";

describe("empty store profile", () => {
  it("starts blank and refuses to create a business before anyone types", () => {
    const empty = createOnboardingData("base");
    expect(empty).toMatchObject({
      businessName: "",
      slug: "",
      serviceName: "",
      durationMinutes: 0,
      priceCents: 0,
      depositCents: 0,
      depositMode: "none",
      openDays: [],
      opensAt: "",
      closesAt: "",
      logoUrl: "",
    });
    expect(empty.depositMode).not.toBe("30");
    expect(empty.durationMinutes).not.toBe(45);
    expect(empty.days?.every((day) => !day.open && day.opensAt === "" && day.closesAt === "")).toBe(true);
    expect(JSON.stringify(empty)).not.toMatch(/Gordão|Corte de Cabelo|Studio da Ana|Corte masculino|09:00|19:00/);

    const create = vi.fn();
    const result = submitStore(empty, create);
    expect(result.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.errors.name).toBe("Digite o nome da sua loja.");
      expect(result.errors.serviceName).toBe("Digite o nome do serviço.");
      expect(result.errors.duration).toBe("Escolha a duração.");
      expect(result.errors.price).toBe("Digite o preço.");
      expect(result.errors.days).toBe("Abra pelo menos um dia.");
      expect(result.errors.logo).toBe("Adicione a logo da loja.");
    }
    expect(onboardingInputSchema.safeParse({
      business: { name: "", slug: "" },
      service: { name: "", durationMinutes: 0, priceCents: 0, depositCents: 0 },
      hours: [],
    }).success).toBe(false);
  });

  it("sends only what was typed, with the deposit off unless the switch is on", () => {
    const data = {
      ...createOnboardingData("base"),
      businessName: "Studio da Teste",
      slug: "studio-da-teste",
      serviceName: "Corte novo",
      durationMinutes: 45,
      priceCents: 4500,
      logoUrl: "https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/logos/corte.webp",
      days: (createOnboardingData("base").days ?? []).map((day) => (
        day.weekday === 1 ? { ...day, open: true, opensAt: "10:00", closesAt: "18:00" } : day
      )),
    };
    const result = storeSubmission(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.service).toEqual({ name: "Corte novo", durationMinutes: 45, priceCents: 4500, depositCents: 0 });
      expect(result.payload.hours).toEqual([{ weekday: 1, opensAt: "10:00", closesAt: "18:00" }]);
      expect(result.payload.business.logoUrl).toBe("https://ce0rcu23vrrdzqap.public.blob.vercel-storage.com/logos/corte.webp");
      expect(JSON.stringify(result.payload)).not.toContain("Studio da Ana");
      expect(JSON.stringify(result.payload)).not.toContain("Corte masculino");
    }
  });

  it("omits logoUrl when the file is only picked, and that payload passes the server schema", () => {
    const data = {
      ...createOnboardingData("base"),
      businessName: "Studio da Teste",
      slug: "studio-da-teste",
      serviceName: "Corte novo",
      durationMinutes: 45,
      priceCents: 4500,
      logoUrl: "",
      days: (createOnboardingData("base").days ?? []).map((day) => (
        day.weekday === 1 ? { ...day, open: true, opensAt: "10:00", closesAt: "18:00" } : day
      )),
    };
    const missing = storeSubmission(data);
    expect(missing.ok).toBe(false);
    const result = storeSubmission(data, { logoSelected: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.business).not.toHaveProperty("logoUrl");
      expect(onboardingInputSchema.safeParse(result.payload).success).toBe(true);
    }
  });
});

describe("slug field states", () => {
  it("covers available, taken, reserved, invalid and a network error", () => {
    expect(slugView({ slug: "studio-da-ana", phase: "ready", available: true, reason: null, suggestions: [] }).message).toBe("Disponível");
    expect(slugView({ slug: "studio-da-ana", phase: "ready", available: true, reason: null, suggestions: ["studio-da-ana-2"] }).suggestions).toEqual([]);
    const taken = slugView({ slug: "studio-da-ana", phase: "ready", available: false, reason: "taken", suggestions: ["studio-da-ana-2", "studio-da-ana-3", "extra"] });
    expect(taken.message).toBe("Esse link já está em uso. Tente outro.");
    expect(taken.suggestions).toEqual(["studio-da-ana-2", "studio-da-ana-3"]);
    expect(slugView({ slug: "studio-da-ana", phase: "ready", available: false, reason: "taken", suggestions: [] }).suggestions).toEqual([]);
    expect(slugView({ slug: "dashboard", phase: "idle" }).message).toBe("Esse link é reservado pelo sistema. Escolha outro.");
    expect(slugView({ slug: "ab", phase: "idle" }).message).toBe("Use de 3 a 40 letras, números ou hífens.");
    expect(slugView({ slug: "studio-da-ana", phase: "error" }).message).toBe("Não deu para verificar agora.");
    expect(slugView({ slug: "studio-da-ana", phase: "ready", available: true, forcedTaken: true, suggestions: ["studio-da-ana-2"] })).toMatchObject({
      status: "taken",
      message: "Esse link já está em uso. Tente outro.",
      suggestions: ["studio-da-ana-2"],
    });
  });
});

describe("logo file check", () => {
  it("rejects a gif and a file over 2 MB", () => {
    expect(logoRejection({ type: "image/gif", size: 1200, name: "logo.gif" })).toBe("Formato não aceito. Envie PNG, JPEG ou WebP.");
    const big = Math.ceil(2.1 * 1024 * 1024);
    expect(logoRejection({ type: "image/jpeg", size: big, name: "foto.jpg" })).toBe("A imagem tem 2,1 MB. O limite é 2 MB.");
    expect(logoRejection({ type: "image/png", size: LOGO_MAX_BYTES, name: "logo.png" })).toBeNull();
    expect(logoRejection({ type: "image/webp", size: 1000, name: "logo.webp" })).toBeNull();
  });
});

describe("old slug redirect notice", () => {
  it("stays off until a 308 from the previous link exists", () => {
    expect(OLD_SLUG_REDIRECT_READY).toBe(true);
  });
});
