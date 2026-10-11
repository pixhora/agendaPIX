// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

function DurationSelect({ onValueChange, defaultValue = "" }: { onValueChange?: (value: string) => void; defaultValue?: string }) {
  return (
    <Select defaultValue={defaultValue} onValueChange={onValueChange}>
      <SelectTrigger aria-label="Duração">
        <SelectValue placeholder="Escolha a duração" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="30">30 min</SelectItem>
        <SelectItem value="45">45 min</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("lista as opções e avisa a escolha", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DurationSelect onValueChange={onValueChange} />);
    const select = screen.getByRole("combobox", { name: "Duração" });
    expect(select).toHaveTextContent("Escolha a duração");
    await user.click(select);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.click(screen.getByRole("option", { name: "45 min" }));
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith("45");
    expect(select).toHaveTextContent("45 min");
  });

  it("marca a opção escolhida com um check e gira a seta ao abrir", async () => {
    const user = userEvent.setup();
    render(<DurationSelect defaultValue="30" />);
    const select = screen.getByRole("combobox", { name: "Duração" });
    expect(select.querySelector("[data-slot=select-icon]")).toBeTruthy();
    expect(select).toHaveAttribute("data-state", "closed");
    await user.click(select);
    expect(select).toHaveAttribute("data-state", "open");
    const chosen = screen.getByRole("option", { name: "30 min" });
    expect(chosen).toHaveAttribute("data-state", "checked");
    expect(chosen.querySelector("[data-slot=select-item-indicator]")).toBeTruthy();
  });

  it("escolhe com o teclado e envia o valor do formulário", async () => {
    const user = userEvent.setup();
    const submitted: { data: FormData | null } = { data: null };
    render(
      <form onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (form instanceof HTMLFormElement) submitted.data = new FormData(form);
      }}>
        <label htmlFor="business">Negócio</label>
        <Select name="businessId" defaultValue="a">
          <SelectTrigger id="business">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Ana</SelectItem>
            <SelectItem value="b">Beto</SelectItem>
          </SelectContent>
        </Select>
        <button type="submit">Abrir</button>
      </form>,
    );
    const select = screen.getByRole("combobox", { name: "Negócio" });
    select.focus();
    await user.keyboard("b");
    expect(select).toHaveTextContent("Beto");
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(submitted.data?.get("businessId")).toBe("b");
  });
});
