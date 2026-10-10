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

  it("prefixo e valor preenchido usam a mesma figura, sem negrito grande", () => {
    const { container } = render(
      <MoneyInput id="preco" label="Preço" valueCents={2500} onChangeCents={() => {}} />,
    );
    const prefix = container.querySelector("[data-money-prefix]");
    const input = screen.getByLabelText("Preço");
    expect(prefix).toBeTruthy();
    expect(prefix?.className).toContain("text-base");
    expect(prefix?.className).toContain("font-normal");
    expect(prefix?.className).toContain("text-ink");
    expect(prefix?.className).not.toMatch(/text-lg|font-semibold|font-bold|font-display|text-\[22px\]/);
    expect(input.className).toContain("text-base");
    expect(input.className).toContain("font-normal");
    expect(input.className).toContain("text-ink");
    expect(input.className).not.toMatch(/font-bold|font-display|text-\[22px\]|text-lg/);
    expect(input).toHaveValue("25,00");
  });

  it("campo vazio deixa o prefixo na mesma cor do placeholder", () => {
    const { container } = render(
      <MoneyInput id="preco" label="Preço" valueCents={null} onChangeCents={() => {}} />,
    );
    const prefix = container.querySelector("[data-money-prefix]");
    const input = screen.getByLabelText("Preço");
    expect(prefix?.className).toContain("text-muted");
    expect(prefix?.className).toContain("font-normal");
    expect(input).toHaveAttribute("placeholder", "0,00");
    expect(input.className).toContain("placeholder:text-base");
    expect(input.className).toContain("placeholder:font-normal");
    expect(input.className).toContain("placeholder:text-muted");
  });

  it("erro marca o campo e não troca o tamanho do valor", () => {
    const { container } = render(
      <MoneyInput id="preco" label="Preço" valueCents={1500} error="Informe o preço do serviço." onChangeCents={() => {}} />,
    );
    const input = screen.getByLabelText("Preço");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("font-normal");
    expect(input.className).not.toMatch(/font-bold|text-\[22px\]/);
    expect(container.querySelector("[data-money-prefix]")?.className).toContain("text-ink");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o preço do serviço.");
  });

  it("desabilitado deixa prefixo e valor na cor secundária", () => {
    const { container } = render(
      <MoneyInput id="preco" label="Preço" valueCents={2500} disabled onChangeCents={() => {}} />,
    );
    const input = screen.getByLabelText("Preço");
    expect(input).toBeDisabled();
    expect(input.className).toContain("text-muted");
    expect(container.querySelector("[data-money-prefix]")?.className).toContain("text-muted");
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
