// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MpOnboardingStep } from "@/components/payments/mp-onboarding-step";
import { MP_CONNECT_CONSENT_VERSION } from "@/lib/mercadopago/consent";
import {
  MP_PIX_KEY_CONFIRM_HELP,
  MP_PIX_KEY_CONFIRM_LABEL,
  MP_PIX_KEY_HELP_LABEL,
  MP_PIX_KEY_HELP_URL,
} from "@/lib/mercadopago/connect-copy";
import { presentMpCallback, type MpOwnerStatus } from "@/lib/mercadopago/contract";

const connected: MpOwnerStatus = {
  status: "connected",
  connectedAt: "2026-10-02T15:00:00.000Z",
  expiresAt: null,
  liveMode: true,
  canReceiveDeposits: true,
  hadLegacyPixKey: false,
  consentVersion: MP_CONNECT_CONSENT_VERSION,
  accountName: "Ana S.",
  accountEmailMasked: "an••@gmail.com",
  accountIdLast4: "7766",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("confirmação da chave Pix no recebimento", () => {
  it("não mostra a caixa enquanto o Mercado Pago não está conectado", () => {
    render(<MpOnboardingStep businessId="biz" />);
    expect(screen.queryByRole("checkbox", { name: MP_PIX_KEY_CONFIRM_LABEL })).toBeNull();
    expect(screen.queryByRole("link", { name: MP_PIX_KEY_HELP_LABEL })).toBeNull();
  });

  it("segura o Continuar até marcar e não grava a confirmação", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <MpOnboardingStep
        businessId="biz"
        callback={presentMpCallback("connected", null)}
        ownerStatus={connected}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: MP_PIX_KEY_CONFIRM_LABEL });
    expect(checkbox).not.toBeChecked();
    const blocked = screen.getByRole("button", { name: "Continuar" });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAttribute("aria-describedby", "mp-pix-key-required");
    expect(screen.getByText(MP_PIX_KEY_CONFIRM_HELP).id).toBe("mp-pix-key-required");
    expect(screen.queryByRole("link", { name: "Continuar" })).toBeNull();

    const help = screen.getByRole("link", { name: /Como cadastrar/ });
    expect(help).toHaveAttribute("href", MP_PIX_KEY_HELP_URL);
    expect(help).toHaveAttribute("target", "_blank");
    expect(help).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.queryByText(MP_PIX_KEY_CONFIRM_HELP)).toBeNull();
    const next = screen.getByRole("link", { name: "Continuar" });
    expect(next).toHaveAttribute("href", "/onboarding/concluir");
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
