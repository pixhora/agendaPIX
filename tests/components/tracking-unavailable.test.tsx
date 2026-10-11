// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrackingUnavailable } from "@/components/booking/tracking-unavailable";
import { TRACKING_ASK_STORE, TRACKING_LINK_UPDATED, TALK_TO_STORE } from "@/components/booking/customer-copy";

afterEach(() => cleanup());

describe("404 do acompanhamento", () => {
  it("com slug e WhatsApp mostra o botão e não diz que está confirmado", () => {
    render(<TrackingUnavailable slug="salao-da-ana" whatsapp="+5511988887777" />);
    expect(screen.getByRole("heading", { name: TRACKING_LINK_UPDATED })).toBeTruthy();
    expect(screen.queryByText(/confirmado/i)).toBeNull();
    expect(screen.queryByText(/não encontrado/i)).toBeNull();
    const talk = screen.getByRole("link", { name: TALK_TO_STORE });
    expect(talk.getAttribute("href")).toBe("https://wa.me/5511988887777");
    expect(talk.className).toContain("bg-pix");
    expect(screen.queryByText(TRACKING_ASK_STORE)).toBeNull();
  });

  it("sem slug mostra o texto de apoio mesmo que exista um telefone", () => {
    render(<TrackingUnavailable slug={null} whatsapp="+5511988887777" />);
    expect(screen.getByRole("heading", { name: TRACKING_LINK_UPDATED })).toBeTruthy();
    expect(screen.getByText(TRACKING_ASK_STORE)).toBeTruthy();
    expect(screen.queryByRole("link", { name: TALK_TO_STORE })).toBeNull();
  });

  it("com slug e sem WhatsApp também fica no texto de apoio", () => {
    render(<TrackingUnavailable slug="salao-da-ana" whatsapp={null} />);
    expect(screen.getByText(TRACKING_ASK_STORE)).toBeTruthy();
    expect(screen.queryByRole("link", { name: TALK_TO_STORE })).toBeNull();
  });
});
