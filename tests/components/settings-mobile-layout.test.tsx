// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame } from "../../components/dashboard/app-frame";
import { supportWhatsappUrl } from "../../lib/support-contact";

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: signOutMock },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/settings",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
}));

const supportHref = supportWhatsappUrl({ SUPPORT_WHATSAPP_NUMBER: "5511987654321" });

function renderFrame(props: { legalPagesPublished?: boolean; supportWhatsappHref?: string | null; children?: ReactNode }) {
  const { children = "Configurações", ...rest } = props;
  return render(
    <AppFrame ownerName="Loja do Teteu" businesses={[{ id: "1", name: "Studio Tatuarte", slug: "studio-tatuarte" }]} {...rest}>
      {children}
    </AppFrame>,
  );
}

afterEach(() => {
  cleanup();
  signOutMock.mockClear();
});

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  for (const method of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const) {
    if (!(method in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, method, {
        configurable: true,
        value: () => (method === "hasPointerCapture" ? false : undefined),
      });
    }
  }
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

describe("menu de links do painel", () => {
  it("abre pelo botão do logo, prende o foco e devolve ao fechar", async () => {
    const user = userEvent.setup();
    renderFrame({ legalPagesPublished: true, supportWhatsappHref: supportHref });
    const trigger = screen.getByRole("button", { name: /Abrir links do AgendaPix/ });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Links do AgendaPix" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const support = within(dialog).getByRole("link", { name: /Suporte no WhatsApp/ });
    const terms = within(dialog).getByRole("link", { name: "Termos de uso" });
    const privacy = within(dialog).getByRole("link", { name: "Política de privacidade" });
    const leave = within(dialog).getByRole("button", { name: "Sair" });
    expect(support.compareDocumentPosition(terms) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(terms.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(privacy.compareDocumentPosition(leave) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(support).toHaveFocus();

    leave.focus();
    await user.tab();
    expect(support).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("fecha no toque fora e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    renderFrame({ legalPagesPublished: true, supportWhatsappHref: supportHref });
    const trigger = screen.getByRole("button", { name: /Abrir links do AgendaPix/ });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Links do AgendaPix" });
    const overlay = dialog.previousElementSibling;
    expect(overlay).not.toBeNull();
    await user.click(overlay as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("omite termos, privacidade e suporte quando a flag ou o link não existem", async () => {
    const user = userEvent.setup();
    const { unmount } = renderFrame({ legalPagesPublished: false, supportWhatsappHref: null });
    await user.click(screen.getByRole("button", { name: /Abrir links do AgendaPix/ }));
    let dialog = screen.getByRole("dialog", { name: "Links do AgendaPix" });
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sair" })).toBeInTheDocument();
    unmount();

    const legalOnly = renderFrame({ legalPagesPublished: true, supportWhatsappHref: null });
    await user.click(screen.getByRole("button", { name: /Abrir links do AgendaPix/ }));
    dialog = screen.getByRole("dialog", { name: "Links do AgendaPix" });
    expect(within(dialog).getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos");
    expect(within(dialog).getByRole("link", { name: "Política de privacidade" })).toHaveAttribute("href", "/privacidade");
    expect(within(dialog).queryByRole("link", { name: /Suporte no WhatsApp/ })).not.toBeInTheDocument();
    legalOnly.unmount();

    renderFrame({ legalPagesPublished: false, supportWhatsappHref: supportHref });
    await user.click(screen.getByRole("button", { name: /Abrir links do AgendaPix/ }));
    dialog = screen.getByRole("dialog", { name: "Links do AgendaPix" });
    expect(within(dialog).getByRole("link", { name: /Suporte no WhatsApp/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Termos de uso" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Política de privacidade" })).not.toBeInTheDocument();
  });

  it("abre o WhatsApp numa aba nova com a URL do servidor e encerra a sessão ao sair", async () => {
    const user = userEvent.setup();
    expect(supportHref).toBe("https://wa.me/5511987654321");
    const source = readFileSync(join(process.cwd(), "components/dashboard/app-frame.tsx"), "utf8");
    expect(source).not.toMatch(/https:\/\/wa\.me\/\d+/);

    renderFrame({ legalPagesPublished: false, supportWhatsappHref: supportHref });
    await user.click(screen.getByRole("button", { name: /Abrir links do AgendaPix/ }));
    const dialog = screen.getByRole("dialog", { name: "Links do AgendaPix" });
    const support = within(dialog).getByRole("link", { name: /Suporte no WhatsApp/ });
    expect(support).toHaveAttribute("href", supportHref);
    expect(support).toHaveAttribute("target", "_blank");
    expect(support).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(support).toHaveAttribute("rel", expect.stringContaining("noreferrer"));

    await user.click(within(dialog).getByRole("button", { name: "Sair" }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});

describe("seletor de negócio", () => {
  it("mostra o nome em texto e só o botão Abrir quando há um negócio", async () => {
    const { DashboardShell } = await import("../../components/dashboard/shell");
    const html = renderToStaticMarkup(
      <DashboardShell
        title="Configurações"
        description="Painel"
        path="/dashboard/settings"
        businesses={[{ id: "1", name: "Studio Tatuarte" }]}
        businessId="1"
      >
        corpo
      </DashboardShell>,
    );
    expect(html).toContain("Studio Tatuarte");
    expect(html).toContain("Abrir");
    expect(html).not.toContain("<select");
    expect(html).toContain('name="businessId"');
  });

  it("usa o select padrão com a seta a 16px da borda", async () => {
    const { DashboardShell } = await import("../../components/dashboard/shell");
    const html = renderToStaticMarkup(
      <DashboardShell
        title="Configurações"
        description="Painel"
        path="/dashboard/settings"
        businesses={[
          { id: "1", name: "Studio Tatuarte" },
          { id: "2", name: "Barbearia do Teteu" },
        ]}
        businessId="1"
      >
        corpo
      </DashboardShell>,
    );
    expect(html).toContain("<select");
    expect(html).toContain("pr-10");
    expect(html).toContain("right-4");
    expect(html).toContain("size-4");
    expect(html).toContain("lucide-chevron-down");
  });
});

describe("ajuda para instalar o Mercado Pago", () => {
  it("fecha na altura do texto e troca o marcador por um chevron", async () => {
    const { MpInstallHelp } = await import("../../components/payments/mp-install-help");
    render(createElement(MpInstallHelp));
    const summary = screen.getByText("Ainda não tenho Mercado Pago").closest("summary");
    expect(summary).not.toBeNull();
    expect(summary?.className).not.toContain("min-h-11");
    expect(summary?.className).toContain("p-4");
    expect(summary?.className).toContain("list-none");
    expect(summary?.querySelector(".lucide-chevron-right")).not.toBeNull();
    expect(summary?.parentElement?.className).not.toContain("p-4");
  });
});

describe("links no fim de Configurações", () => {
  it("mostra o item com ícone e os links pequenos só no celular", async () => {
    const { SettingsPanelLinks } = await import("../../components/dashboard/settings-links");
    const html = renderToStaticMarkup(createElement(SettingsPanelLinks, {
      legalPagesPublished: true,
      supportWhatsappHref: "https://wa.me/5511987654321",
    }));
    expect(html).toContain("md:hidden");
    expect(html).toContain("text-sm");
    expect(html).toContain("flex-wrap");
    expect(html).toContain('href="/termos"');
    expect(html).toContain('href="/privacidade"');
    expect(html.split("Suporte no WhatsApp").length - 1).toBe(2);
    expect(html).toContain("lucide-message-circle");
  });
});
