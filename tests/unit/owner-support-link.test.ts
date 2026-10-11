import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
}));

describe("suporte no painel do dono", () => {
  it("mostra o link quando a página manda o WhatsApp de SUPPORT_WHATSAPP_NUMBER", async () => {
    const { AppFrame } = await import("../../components/dashboard/app-frame");
    const href = "https://wa.me/5511912345678";
    // children entra no objeto porque o tipo de AppFrame o exige e este arquivo não usa JSX.
    // eslint-disable-next-line react/no-children-prop
    const html = renderToStaticMarkup(createElement(AppFrame, {
      ownerName: "Ana Souza",
      businesses: [{ id: "1", name: "Studio Bella", slug: "studio-bella" }],
      supportWhatsappHref: href,
      children: "Agenda",
    }));
    expect(html.split(`href="${href}"`).length - 1).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Suporte no WhatsApp");
  });

  it("esconde o link quando o número não vem e o painel continua", async () => {
    const { AppFrame } = await import("../../components/dashboard/app-frame");
    // eslint-disable-next-line react/no-children-prop
    const html = renderToStaticMarkup(createElement(AppFrame, {
      ownerName: "Ana Souza",
      businesses: [{ id: "1", name: "Studio Bella", slug: "studio-bella" }],
      supportWhatsappHref: null,
      children: "Agenda",
    }));
    expect(html).toContain("Ana Souza");
    expect(html).not.toContain("Suporte no WhatsApp");
    expect(html).not.toContain("wa.me");
  });
});
