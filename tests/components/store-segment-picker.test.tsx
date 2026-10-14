// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { OnboardingData } from "@/components/onboarding/types";
import { emptyStoreDays } from "@/lib/store-profile/model";

vi.mock("@/components/store/use-store-slug", () => ({
  useStoreSlug: () => ({ status: "idle", message: null, suggestions: [] }),
}));

const { StoreProfileForm } = await import("@/components/store/StoreProfileForm");

const start: OnboardingData = {
  plan: "base", businessName: "", slug: "", logoUrl: "", serviceName: "", durationMinutes: 0, priceCents: 0,
  depositCents: 0, openDays: [], opensAt: "", closesAt: "", email: "", days: emptyStoreDays(),
};

// Espelho do estado, atualizado no handler (fora do render).
const state: { current: OnboardingData } = { current: start };
function Harness() {
  const [data, setData] = useState(start);
  return <StoreProfileForm data={data} prefix="agendapix.dev.br/" onChange={(partial) => {
    state.current = { ...state.current, ...partial };
    setData((prev) => ({ ...prev, ...partial }));
  }} onContinue={() => undefined} />;
}

afterEach(() => {
  cleanup();
  state.current = start;
});

describe("tipo de negócio no cadastro", () => {
  it("mostra os tipos como opções acessíveis e preenche serviço, duração e horários", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Tipo de negócio" });
    expect(group).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Barbearia" }));
    expect((screen.getByRole("radio", { name: "Barbearia" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Nome do serviço") as HTMLInputElement).value).toBe("Corte masculino");
    expect((screen.getByLabelText("Duração") as HTMLSelectElement).value).toBe("30");
    expect(state.current.segment).toBe("barbearia");
    expect(state.current.days?.filter((day) => day.open)).toHaveLength(5);
    expect(state.current.priceCents).toBe(0);
  });

  it("o que a pessoa digitou fica, mesmo trocando de tipo", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Nome do serviço"), { target: { value: "Design de sobrancelha" } });
    fireEvent.click(screen.getByRole("radio", { name: "Estética" }));
    expect((screen.getByLabelText("Nome do serviço") as HTMLInputElement).value).toBe("Design de sobrancelha");
    expect(state.current.durationMinutes).toBe(60);
  });
});
