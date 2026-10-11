// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingComplete } from "@/components/onboarding/OnboardingComplete";
import { writeCommitResult } from "@/components/onboarding/storage";

const businessId = "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";

function mpStatus(status: "connected" | "not_connected") {
  return {
    ok: true,
    json: async () => ({
      status,
      connectedAt: null,
      expiresAt: null,
      liveMode: true,
      canReceiveDeposits: status === "connected",
      hadLegacyPixKey: false,
      consentVersion: null,
      accountName: null,
      accountEmailMasked: null,
      accountIdLast4: null,
    }),
  };
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("conclusão do cadastro", () => {
  it("pede para conectar quando o Mercado Pago não está ligado", async () => {
    writeCommitResult({ slug: "salao-da-ana", publicPath: "/salao-da-ana", businessId });
    vi.stubGlobal("fetch", vi.fn(async () => mpStatus("not_connected")));
    render(<OnboardingComplete />);
    expect(await screen.findByRole("heading", { name: "Sua agenda está no ar" })).toBeTruthy();
    expect(await screen.findByText("Conecte o Mercado Pago para receber o sinal no Pix.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Conectar agora" })).toHaveAttribute("href", "/onboarding/recebimento");
    expect(screen.queryByText(/sinal pago no Pix/)).toBeNull();
  });

  it("mantém o texto de compartilhar quando o Mercado Pago está conectado", async () => {
    writeCommitResult({ slug: "salao-da-ana", publicPath: "/salao-da-ana", businessId });
    vi.stubGlobal("fetch", vi.fn(async () => mpStatus("connected")));
    render(<OnboardingComplete />);
    expect(await screen.findByText("Compartilhe o link no WhatsApp e no Instagram. Cada reserva chega com o sinal pago no Pix.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Conectar agora" })).toBeNull();
  });
});
