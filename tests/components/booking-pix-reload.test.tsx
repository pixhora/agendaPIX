// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { pixResumePayload, pixResumeStorageKey } from "@/components/booking/pix-resume";

const slug = "studio-ana";
const bookingId = "00000000-0000-4000-8000-0000000000c1";
const serviceId = "00000000-0000-4000-8000-0000000000c2";
const storageKey = pixResumeStorageKey(slug);
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const payment = {
  bookingId,
  status: "pending_payment",
  startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  expiresAt,
  payment: {
    id: "00000000-0000-4000-8000-0000000000c3",
    provider: "fake",
    externalId: null,
    amountCents: 1000,
    status: "pending",
    expiresAt,
    qrCodeDataUrl: null,
    copyPaste: "00020126580014br.gov.bcb.pix",
  },
  policy: null,
};

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it("mantém a reserva quando o Pix não carrega e tenta de novo", async () => {
  sessionStorage.setItem(storageKey, pixResumePayload({
    bookingId,
    accessToken: "token-pix",
    expiresAt,
    serviceId,
  }));
  window.history.replaceState(null, "", `/${slug}?bookingId=${bookingId}`);
  let fail = true;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes("/payment")) throw new Error(`pedido inesperado: ${url}`);
    if (fail) throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(payment), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <BookingFlow
      slug={slug}
      initialBookingId={bookingId}
      previewBusiness={{
        name: "Studio Ana",
        timezone: "America/Sao_Paulo",
        services: [{
          id: serviceId,
          name: "Corte",
          durationMinutes: 30,
          priceCents: 5000,
          depositCents: 1000,
          bookable: true,
        }],
      }}
    />,
  );

  expect(await screen.findByRole("heading", { name: "Não conseguimos carregar seu Pix" })).toBeVisible();
  expect(screen.queryByRole("radiogroup", { name: /Serviços/ })).toBeNull();
  expect(sessionStorage.getItem(storageKey)).toContain(bookingId);
  expect(window.location.search).toContain(`bookingId=${bookingId}`);

  fail = false;
  await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));
  expect(await screen.findByRole("button", { name: "Copiar código" })).toBeVisible();
  expect(sessionStorage.getItem(storageKey)).toContain(bookingId);
  expect(window.location.search).toContain(`bookingId=${bookingId}`);
});
