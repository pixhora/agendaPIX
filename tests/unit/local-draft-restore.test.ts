import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftResume } from "../../components/onboarding/DraftResume";
import { depositFromPercent } from "../../lib/money";
import { createOnboardingData } from "../../lib/onboarding/flow";
import {
  decideLocalDraftRestore,
  draftResumeLines,
  liveOnboardingData,
  localDraftEnvelope,
  shouldClearDraftOnSessionChange,
} from "../../lib/onboarding/local-draft";
import { normalizeSlug } from "../../lib/slug";
import type { OnboardingData } from "../../components/onboarding/types";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");

/** Values reported on the device. They are not defaults in this repo. */
const INCIDENT: OnboardingData = {
  plan: "base",
  businessName: "Barbearia do Gordão",
  slug: "barbearia-do-gordao",
  serviceName: "Corte de Cabelo",
  durationMinutes: 45,
  priceCents: 4500,
  depositCents: 2250,
  depositMode: "50",
  openDays: [1, 2, 3, 4, 5, 6],
  opensAt: "09:00",
  closesAt: "19:00",
  email: "",
  logoUrl: "",
};

function decide(raw: unknown, sessionEmail: string | null, step = "service") {
  return decideLocalDraftRestore({
    raw,
    step,
    draftId: null,
    now: NOW,
    sessionEmail,
    plan: "base",
  });
}

describe("leftover onboarding draft on the same device", () => {
  it("does not ship Barbearia do Gordão, Corte de Cabelo or R$ 22,50 as defaults", () => {
    expect(createOnboardingData("base")).toMatchObject({
      businessName: "",
      slug: "",
      serviceName: "",
      priceCents: 0,
      depositCents: 0,
    });
    expect(normalizeSlug(INCIDENT.businessName, { final: true })).toBe(INCIDENT.slug);
    expect(depositFromPercent(4500, 50)).toBe(2250);
  });

  it("keeps a device draft out of the live form until the owner continues it", () => {
    const decision = decide(localDraftEnvelope(INCIDENT, null, new Date(NOW).toISOString()), null);
    expect(decision.action).toBe("prompt");
    const hidden = liveOnboardingData(decision, false, "base");
    expect(hidden.businessName).toBe("");
    expect(hidden.serviceName).toBe("");
    expect(hidden.priceCents).toBe(0);
    expect(hidden.depositCents).toBe(0);

    const accepted = liveOnboardingData(decision, true, "base");
    expect(accepted.businessName).toBe("Barbearia do Gordão");
    expect(accepted.serviceName).toBe("Corte de Cabelo");
    expect(accepted.priceCents).toBe(4500);
    expect(accepted.depositCents).toBe(2250);
    expect(draftResumeLines(accepted).detail).toContain("Corte de Cabelo");
    expect(draftResumeLines(accepted).detail).toContain("45,00");
    expect(draftResumeLines(accepted).detail).toContain("22,50");
  });

  it("drops a draft that has no savedAt, and does not keep a logo url", () => {
    expect(decide(INCIDENT, null)).toEqual({ action: "discard", reason: "expired" });
    const raw = localDraftEnvelope(
      { ...INCIDENT, logoUrl: "https://blob.fake.local/logos/loja.webp" },
      null,
      "not-a-date",
    );
    expect(raw.data.logoUrl).toBe("");
    expect(decide(raw, null)).toEqual({ action: "discard", reason: "expired" });
  });

  it("drops a draft bound to another account instead of offering it", () => {
    const raw = localDraftEnvelope({ ...INCIDENT, email: "teste@example.com" }, "teste@example.com", new Date(NOW).toISOString());
    expect(decide(raw, "dono@example.com")).toEqual({ action: "discard", reason: "other_account" });
    expect(liveOnboardingData(decide(raw, "dono@example.com"), false, "base").businessName).toBe("");
  });

  it("drops a dated draft older than 7 days", () => {
    const savedAt = new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString();
    const raw = localDraftEnvelope(INCIDENT, null, savedAt);
    expect(decide(raw, null)).toEqual({ action: "discard", reason: "expired" });
  });

  it("asks again when the same account still has a fresh draft", () => {
    const raw = localDraftEnvelope({ ...INCIDENT, email: "dono@example.com" }, "dono@example.com", new Date(NOW).toISOString());
    const decision = decide(raw, "dono@example.com");
    expect(decision.action).toBe("prompt");
    expect(liveOnboardingData(decision, false, "base").slug).toBe("");
  });

  it("clears the draft on sign-out and on a switch to another account", () => {
    expect(shouldClearDraftOnSessionChange("teste@example.com", null, "teste@example.com")).toBe(true);
    expect(shouldClearDraftOnSessionChange("teste@example.com", "dono@example.com", "teste@example.com")).toBe(true);
    expect(shouldClearDraftOnSessionChange("teste@example.com", "dono@example.com", "dono@example.com")).toBe(false);
    expect(shouldClearDraftOnSessionChange(null, "dono@example.com", "")).toBe(false);
    const logout = readFileSync(resolve(process.cwd(), "components/dashboard/logout.tsx"), "utf8");
    const flow = readFileSync(resolve(process.cwd(), "components/onboarding/OnboardingFlow.tsx"), "utf8");
    expect(logout).toContain("clearOnboardingProgress()");
    expect(flow).toContain("decideLocalDraftRestore");
    expect(flow).not.toContain("setData(restored)");
  });

  it("shows the leftover draft as a choice, not as the page preview", () => {
    const lines = draftResumeLines(INCIDENT);
    const html = renderToStaticMarkup(createElement(DraftResume, {
      title: lines.title,
      detail: lines.detail,
      onContinue: () => undefined,
      onReset: () => undefined,
    }));
    expect(html).toContain("Continuar o cadastro deste aparelho?");
    expect(html).toContain("Barbearia do Gordão");
    expect(html).toContain("Corte de Cabelo");
    expect(html).toContain("22,50");
    expect(html).toContain("Continuar rascunho");
    expect(html).toContain("Começar do zero");
    expect(html).not.toContain("Prévia da sua página");
    expect(html).not.toContain("Salvo neste aparelho");
  });
});
