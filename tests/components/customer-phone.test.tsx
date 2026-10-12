// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StepCustomer } from "@/components/booking/StepCustomer";
import { CUSTOMER_PHONE_ERROR } from "@/components/booking/customer-copy";
import type { AvailabilitySlot, PublicService } from "@/components/booking/types";

const service: PublicService = {
  id: "svc",
  name: "Corte",
  durationMinutes: 30,
  priceCents: 8000,
  depositCents: 0,
};
const slot: AvailabilitySlot = {
  startsAt: "2030-01-02T15:00:00.000Z",
  endsAt: "2030-01-02T15:30:00.000Z",
};

function Form({ onSubmit }: { onSubmit: (phone: string) => void }) {
  const [name, setName] = useState("Ana Souza");
  const [phone, setPhone] = useState("");
  return (
    <StepCustomer
      service={service}
      slot={slot}
      timezone="America/Sao_Paulo"
      name={name}
      phone={phone}
      cpf=""
      isSubmitting={false}
      errorMessage={null}
      onChangeName={setName}
      onChangePhone={setPhone}
      onChangeCpf={() => undefined}
      onBack={() => undefined}
      onSubmit={onSubmit}
      requiresPayerCpf={false}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("WhatsApp do agendamento", () => {
  it.each([
    ["011 99999-9999", "(11) 99999-9999"],
    ["+55 14 99999-9999", "(14) 99999-9999"],
    ["(14) 99999-9999 ", "(14) 99999-9999"],
    ["14999999999", "(14) 99999-9999"],
  ])("aceita %s e segue o agendamento", (raw, formatted) => {
    const submitted: string[] = [];
    render(<Form onSubmit={(phone) => submitted.push(phone)} />);
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: raw } });
    expect(screen.getByLabelText("WhatsApp")).toHaveValue(formatted);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    expect(submitted).toEqual([formatted]);
    expect(screen.queryByText(CUSTOMER_PHONE_ERROR)).toBeNull();
  });

  it("só avisa quando o número ainda está curto", () => {
    const submitted: string[] = [];
    render(<Form onSubmit={(phone) => submitted.push(phone)} />);
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "14999" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    expect(screen.getByText(CUSTOMER_PHONE_ERROR)).toBeVisible();
    expect(submitted).toEqual([]);
  });
});
