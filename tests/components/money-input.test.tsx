// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoneyInput } from "@/components/ui/money-input";

afterEach(cleanup);

function Controlled({ onChange, readOnly = false }: { onChange: (cents: number | null) => void; readOnly?: boolean }) {
  const [cents, setCents] = useState<number | null>(null);
  return (
    <MoneyInput
      id="sinal"
      label="Valor do sinal"
      valueCents={cents}
      readOnly={readOnly}
      onChangeCents={(next) => {
        onChange(next);
        setCents(next);
      }}
    />
  );
}

describe("MoneyInput", () => {
  it("colar um valor em reais informa centavos e mostra o formato brasileiro", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText("Valor do sinal");
    await user.click(input);
    await user.paste("25,00");
    expect(onChange).toHaveBeenLastCalledWith(2500);
    expect(input).toHaveValue("25,00");
  });

  it("colar texto que não é dinheiro mostra o erro e não altera o valor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText("Valor do sinal");
    await user.click(input);
    await user.paste("abc");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Não entendemos esse valor. Digite só os números.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("modo somente leitura bloqueia a digitação", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} readOnly />);
    const input = screen.getByLabelText("Valor do sinal");
    expect(input).toHaveAttribute("readonly");
    await user.click(input);
    await user.keyboard("12");
    expect(onChange).not.toHaveBeenCalled();
  });
});
