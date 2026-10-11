// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MpConnectForm } from "@/components/payments/mp-connect-form";

const submitGuards: Array<(event: Event) => void> = [];

afterEach(() => {
  for (const guard of submitGuards) document.removeEventListener("submit", guard);
  submitGuards.length = 0;
  cleanup();
});

function renderForm() {
  render(
    <MpConnectForm
      businessId="biz"
      returnTo="/onboarding"
      requireAck
      acknowledged
      onAcknowledgedChange={() => undefined}
      ackInvalid={false}
      submitLabel="Continuar para o Mercado Pago"
      onBlocked={() => undefined}
    />,
  );
  const prevented: boolean[] = [];
  // O onSubmit do React escuta no container, depois do form. O document pega o defaultPrevented já marcado.
  const guard = (event: Event) => {
    prevented.push(event.defaultPrevented);
    event.preventDefault();
  };
  document.addEventListener("submit", guard);
  submitGuards.push(guard);
  return { prevented };
}

describe("trava de envio do Mercado Pago", () => {
  it("solta a trava no pageshow do bfcache e num erro", async () => {
    const user = userEvent.setup();
    const { prevented } = renderForm();
    const button = screen.getByRole("button", { name: "Continuar para o Mercado Pago" });

    await user.click(button);
    await user.click(button);
    expect(prevented).toEqual([false, true]);

    const restored = new Event("pageshow");
    Object.defineProperty(restored, "persisted", { value: true });
    window.dispatchEvent(restored);
    await user.click(button);
    expect(prevented).toEqual([false, true, false]);

    await user.click(button);
    expect(prevented.at(-1)).toBe(true);
    window.dispatchEvent(new Event("error"));
    await user.click(button);
    expect(prevented.at(-1)).toBe(false);
  });

  it("não solta a trava num pageshow que não veio do bfcache", async () => {
    const user = userEvent.setup();
    const { prevented } = renderForm();
    const button = screen.getByRole("button", { name: "Continuar para o Mercado Pago" });
    await user.click(button);
    const fresh = new Event("pageshow");
    Object.defineProperty(fresh, "persisted", { value: false });
    window.dispatchEvent(fresh);
    await user.click(button);
    expect(prevented).toEqual([false, true]);
  });
});
