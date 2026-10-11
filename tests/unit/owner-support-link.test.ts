import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { supportWhatsappUrl } from "../../lib/support-contact";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
}));

describe("suporte no painel do dono", () => {
  it("reusa o mesmo link de WhatsApp da landing", async () => {
    const { AppFrame } = await import("../../components/dashboard/app-frame");
    // children entra no objeto porque o tipo de AppFrame o exige e este arquivo não usa JSX.
    // eslint-disable-next-line react/no-children-prop
    const html = renderToStaticMarkup(createElement(AppFrame, {
      ownerName: "Ana Souza",
      businesses: [{ id: "1", name: "Studio Bella", slug: "studio-bella" }],
      children: "Agenda",
    }));
    const href = `href="${supportWhatsappUrl()}"`;
    expect(html.split(href).length - 1).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Suporte no WhatsApp");
  });
});
