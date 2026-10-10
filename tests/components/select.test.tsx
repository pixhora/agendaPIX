// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "@/components/ui/input";

afterEach(cleanup);

describe("Select", () => {
  it("lista as opções e avisa a escolha", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select aria-label="Duração" defaultValue="" onChange={onChange}>
        <option value="">Escolha a duração</option>
        <option value="30">30 min</option>
        <option value="45">45 min</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "Duração" });
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await user.selectOptions(select, "45");
    expect(onChange).toHaveBeenCalledOnce();
    expect(select).toHaveValue("45");
  });
});
