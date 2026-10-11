// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HoursPrototypes } from "@/components/dev/hours-prototypes";

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

describe("protótipo de hora digitável", () => {
  it("substitui a hora ao digitar e passa para os minutos", async () => {
    const user = userEvent.setup();
    render(<HoursPrototypes />);
    const section = document.getElementById("digitar");
    if (!section) throw new Error("seção ausente");
    const view = within(section);
    await user.click(view.getByRole("checkbox", { name: "Segunda: aberto" }));
    const hour = view.getByRole("spinbutton", { name: "Início, hora" });
    await user.click(hour);
    await user.keyboard("13");
    expect(hour).toHaveValue("13");
    expect(view.getByRole("spinbutton", { name: "Início, minuto" })).toHaveFocus();
  });
});
