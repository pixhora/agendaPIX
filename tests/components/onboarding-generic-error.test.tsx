// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingError from "@/app/onboarding/error";
import { DRAFT_KEY } from "@/components/onboarding/storage";
import { onboardingBoundaryLog } from "@/lib/onboarding/mp-return-error";

const EMAIL = "ana.silva@gmail.com";
const PHONE = "5514999887766";
const CODE = "oauth-code-sentinel";
const STATE = "oauth-state-sentinel";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("error boundary geral do cadastro", () => {
  it("loga pelo onboardingBoundaryLog, sem e-mail, telefone, code ou state", async () => {
    const error = Object.assign(
      new Error(`falha ${EMAIL} no ${PHONE} ?code=${CODE}&state=${STATE}`),
      { digest: "digest-ok" },
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const retry = vi.fn();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ businessName: "Rascunho antigo" }));

    render(<OnboardingError error={error} retry={retry} />);

    expect(screen.getByRole("heading", { name: "Algo deu errado no cadastro" })).toBeInTheDocument();
    expect(screen.getByText('Seu cadastro está salvo. Toque em "Tentar de novo" para continuar.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(EMAIL);
    expect(document.body.textContent).not.toContain(PHONE);
    expect(document.body.textContent).not.toContain(CODE);
    expect(document.body.textContent).not.toContain(STATE);

    const expected = onboardingBoundaryLog(error);
    const boundaryLogs = spy.mock.calls.filter((args) => args.some((arg) => typeof arg === "string" && arg.includes("onboarding_mp_return")));
    expect(boundaryLogs).toEqual([[expected]]);
    for (const args of spy.mock.calls) {
      expect(args.some((arg) => arg === error || arg instanceof Error)).toBe(false);
      const line = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
      expect(line).not.toContain(EMAIL);
      expect(line).not.toContain(PHONE);
      expect(line).not.toContain(CODE);
      expect(line).not.toContain(STATE);
    }
    expect(expected).toContain("digest=digest-ok");
    expect(expected).toContain("[email]");
    expect(expected).toContain("[telefone]");
    expect(expected).toContain("code=[omitido]");
    expect(expected).toContain("state=[omitido]");

    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DRAFT_KEY)).toContain("Rascunho antigo");
  });
});
