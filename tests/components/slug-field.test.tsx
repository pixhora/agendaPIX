// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlugField } from "@/components/store/SlugField";

afterEach(cleanup);

const base = {
  id: "slug",
  prefix: "agendapix.dev.br/",
  value: "studio-do-teteu",
  onValueChange: () => {},
};

describe("SlugField", () => {
  it("marca o campo como inválido quando o link está em uso", () => {
    render(<SlugField {...base} status="taken" message="Esse link já está em uso." />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Esse link já está em uso.")).toBeInTheDocument();
  });

  it("não marca como inválido quando o link está disponível", () => {
    render(<SlugField {...base} status="available" message="Disponível" />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("Disponível")).toBeInTheDocument();
  });

  it("clicar numa sugestão envia o link sugerido", async () => {
    const user = userEvent.setup();
    const onPickSuggestion = vi.fn();
    render(
      <SlugField {...base} status="taken" message="Em uso." suggestions={["studio-do-teteu-2"]} onPickSuggestion={onPickSuggestion} />,
    );
    await user.click(screen.getByRole("button", { name: "studio-do-teteu-2" }));
    expect(onPickSuggestion).toHaveBeenCalledWith("studio-do-teteu-2");
  });

  it("erro de rede oferece tentar de novo", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<SlugField {...base} status="error" message="Não conseguimos verificar agora." onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: /tentar/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
