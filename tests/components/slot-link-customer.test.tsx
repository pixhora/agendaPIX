// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlotLinkCustomer } from "@/components/slot-link/slot-link-customer";
import { AgendaPixFooter } from "@/components/slot-link/agenda-pix-footer";
import { SlotLinkNotice } from "@/components/slot-link/slot-link-notice";
import { lockPayPayload, memorySlotLinkStores, readOrCreatePayKey, readPayResume, slotLinkSessionKey, slotLinkStorageKey } from "@/lib/slot-link/idempotency";
import { SlotLinkStorageSweep } from "@/components/slot-link/storage-sweep";
import { SentLinks } from "@/components/slot-link/sent-links";
import { createSlotLinkToken } from "../../lib/bookings/slot-link-token";
import { CANCEL_EXPIRED, CANCEL_PAID, CONNECT_MERCADO_PAGO, CUSTOMER_BOOKINGS_PAUSED, CUSTOMER_CONFLICT_BODY, CUSTOMER_CONFLICT_TITLE, CUSTOMER_CPF_REQUIRED, CUSTOMER_IN_PROGRESS, CUSTOMER_PAUSED_LATER, CUSTOMER_PAUSED_RECEIPT, CUSTOMER_RETRY_BODY, CUSTOMER_RETRY_TITLE, CUSTOMER_USED_TITLE, OWNER_NETWORK, REISSUE_BODY, REISSUE_EXPIRED, REISSUE_IN_PROGRESS, REISSUE_MP, REISSUE_PAID, REISSUE_TAKEN, REISSUE_TITLE, formatDayMonth, isoDateInZone, weekdayShort } from "@/lib/slot-link/copy";
import { PIX_CHARGE_FAILED_BODY, PIX_CHARGE_FAILED_RETRY, PIX_CHARGE_FAILED_TITLE, PIX_CREATE_FAILED_COPY, PIX_CREATE_FAILED_STORE, PIX_GENERATING_LABEL, TALK_TO_STORE } from "@/components/booking/customer-copy";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/booking/StepPayment", () => ({
  StepPayment: ({ onPaymentConfirmed, booking }: { onPaymentConfirmed: () => void; booking: { payment: { copyPaste: string | null } | null } }) => (
    <div>
      <p>Pix {booking.payment?.copyPaste}</p>
      <button type="button" onClick={onPaymentConfirmed}>Simular pagamento confirmado</button>
    </div>
  ),
}));

vi.mock("@/components/booking/BookingConfirmation", () => ({
  BookingConfirmation: () => <p>Horário confirmado!</p>,
}));

function expectChargeFailedIcon() {
  const icon = screen.getByRole("alert").querySelector("svg");
  expect(icon).not.toBeNull();
  expect(icon).toHaveAttribute("aria-hidden", "true");
  expect(icon).toHaveAttribute("width", "32");
  expect(icon).toHaveAttribute("height", "32");
  expect(icon).toHaveClass("mx-auto");
  expect(icon).toHaveClass("text-ink");
}

const service = { id: "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b", name: "Corte feminino", durationMinutes: 45, priceCents: 12000, depositCents: 4000 };
const token = createSlotLinkToken();

function openBody(status = "pending") {
  return {
    business: { name: "Salao da Ana", slug: "salao", logoUrl: null, contactWhatsapp: "+5511988887777", publicPath: "/salao" },
    service,
    startsAt: "2030-10-18T14:30:00.000Z",
    depositCents: 4000,
    remainingCents: 8000,
    policy: { text: "O sinal confirma o horário.", hash: "ab".repeat(32) },
    expiresAt: "2030-10-18T14:00:00.000Z",
    status,
    requiresPayerCpf: false,
    bookingsPaused: false,
  };
}

function payBody() {
  return {
    bookingId: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c",
    status: "pending_payment",
    startsAt: "2030-10-18T14:30:00.000Z",
    endsAt: "2030-10-18T15:15:00.000Z",
    expiresAt: "2030-10-18T14:45:00.000Z",
    accessToken: "access-token-teste",
    payment: {
      id: "8d2d6c40-3e5f-4061-8c1d-2e3f4a5b6c7d",
      provider: "fake",
      externalId: "pix-1",
      amountCents: 4000,
      status: "pending",
      expiresAt: "2030-10-18T14:45:00.000Z",
      qrCodeDataUrl: null,
      copyPaste: "00020126580014BR.GOV.BCB.PIX",
    },
    policy: {
      text: "O sinal confirma o horário.",
      snapshot: null,
      refundDeadlineAt: null,
      rescheduleDeadlineAt: null,
      refundWindowClosedAtBooking: false,
    },
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

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
});

async function fillAndPay(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Nome"), "Ana Souza");
  await user.type(screen.getByLabelText("WhatsApp"), "11987654321");
  await user.click(screen.getByLabelText("Li e concordo com a política"));
  await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
}

describe("página da cliente", () => {
  it("começa vazia, reaproveita a mesma chave e o 201 só abre o Pix", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const keys: string[] = [];
    const bodies: string[] = [];
    let posts = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        posts += 1;
        const headers = init?.headers as Record<string, string>;
        keys.push(headers["Idempotency-Key"]);
        bodies.push(String(init?.body ?? ""));
        if (posts === 1) throw new TypeError("Failed to fetch");
        return json(201, payBody());
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByLabelText("Nome")).toHaveValue("");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("");
    expect(screen.queryByLabelText("CPF")).toBeNull();
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: "Sem conexão. Verifique sua internet e tente de novo." })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await user.click(await screen.findByRole("button", { name: /Pagar sinal de/ }));
    expect(await screen.findByText(/Pix 00020126580014BR.GOV.BCB.PIX/)).toBeVisible();
    expect(screen.getByTestId("slot-link-payer")).toHaveTextContent("Ana Souza");
    expect(screen.getByTestId("slot-link-payer")).toHaveTextContent("(11) 98765-4321");
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(screen.queryByLabelText("WhatsApp")).toBeNull();
    expect(screen.queryByText(/já foi confirmado|já usado|link_used/i)).toBeNull();
    expect(keys).toEqual([keys[0], keys[0]]);
    expect(bodies).toEqual([bodies[0], bodies[0]]);
    expect(keys[0]?.length).toBeGreaterThan(8);
    const saved = stores.claim.snapshot[await slotLinkStorageKey(token)] ?? "";
    const session = stores.session.snapshot[await slotLinkSessionKey(token)] ?? "";
    expect(saved.includes(token)).toBe(false);
    expect(saved.includes("access-token-teste")).toBe(false);
    expect(saved.includes("accessToken")).toBe(false);
    expect(session.includes("access-token-teste")).toBe(true);
    expect(JSON.parse(saved).expiresAt).toBe("2030-10-18T14:45:00.000Z");
  });

  it("chave diferente com marcação ativa mostra link_in_progress, sem contador e sem dado da outra cliente", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    await readOrCreatePayKey(token, memorySlotLinkStores(), "2030-10-18T18:00:00.000Z", () => "chave-do-outro-aparelho", Date.parse("2030-10-01T12:00:00.000Z"));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        const headers = init?.headers as Record<string, string>;
        expect(headers["Idempotency-Key"]).not.toBe("chave-do-outro-aparelho");
        return json(409, {
          error: { code: "link_in_progress", message: "interno", customerPhone: "+5511911112222" },
        });
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: CUSTOMER_IN_PROGRESS })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver horários disponíveis" })).toHaveAttribute("href", "/salao");
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText(/\+5511911112222|1111/)).toBeNull();
  });

  it("apaga a chave quando o pagamento confirma e quando o link expira", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) return json(201, payBody());
      return json(200, openBody());
    });
    const view = render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByText(/Pix 000201/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Simular pagamento confirmado" }));
    expect(await screen.findByText("Horário confirmado!")).toBeVisible();
    expect(stores.claim.snapshot[await slotLinkStorageKey(token)]).toBeUndefined();
    expect(stores.session.snapshot[await slotLinkSessionKey(token)]).toBeUndefined();

    const expiredStores = memorySlotLinkStores();
    await readOrCreatePayKey(token, expiredStores, "2030-10-18T18:00:00.000Z", () => "44444444-4444-4444-8444-444444444444", Date.parse("2030-10-01T12:00:00.000Z"));
    view.rerender(
      <SlotLinkCustomer
        slug="salao"
        token={token}
        timezone="America/Sao_Paulo"
        stores={expiredStores}
        fetchImpl={vi.fn(async () => json(410, { error: { code: "link_expired", message: "Este link expirou." } }))}
        now={() => new Date("2030-10-01T12:00:00.000Z")}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Este link expirou." })).toBeVisible();
    expect(expiredStores.claim.snapshot[await slotLinkStorageKey(token)]).toBeUndefined();
    expect(expiredStores.session.snapshot[await slotLinkSessionKey(token)]).toBeUndefined();
  });

  it("409 idempotency_conflict reenvia o payload salvo e volta ao mesmo Pix", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const bodies: string[] = [];
    let posts = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        posts += 1;
        bodies.push(String(init?.body ?? ""));
        if (posts === 1) {
          return json(409, {
            error: { code: "idempotency_conflict", message: "Essa chave já foi usada em outro agendamento.", customerPhone: "+5511900000000" },
          });
        }
        return json(201, payBody());
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: CUSTOMER_CONFLICT_TITLE })).toBeVisible();
    expect(screen.getByText(CUSTOMER_CONFLICT_BODY)).toBeVisible();
    const resume = screen.getByRole("button", { name: "Continuar pagamento" });
    expect(resume).toBeEnabled();
    expect(resume.className).toMatch(/bg-pix-deep/);
    expect(resume.className).toMatch(/text-slab-foreground/);
    expect(resume.className).not.toMatch(/!/);
    const slots = screen.getByRole("link", { name: "Ver horários disponíveis" });
    expect(slots).toHaveAttribute("href", "/salao");
    expect(slots.className).toMatch(/border/);
    expect(slots.className).toMatch(/text-ink/);
    expect(slots.className).toMatch(/bg-surface/);
    expect(slots.className).not.toMatch(/bg-pix/);
    expect(screen.queryByText(/\+5511900000000|já foi usada/)).toBeNull();
    expect(screen.queryByLabelText("Nome")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Continuar pagamento" }));
    expect(await screen.findByText(/Pix 00020126580014BR.GOV.BCB.PIX/)).toBeVisible();
    expect(screen.getByTestId("slot-link-payer")).toHaveTextContent("Ana Souza");
    expect(screen.queryByLabelText("WhatsApp")).toBeNull();
    expect(bodies).toEqual([bodies[0], bodies[0]]);
    const saved = JSON.parse(stores.claim.snapshot[await slotLinkStorageKey(token)] ?? "{}") as { payload?: { customer?: { name?: string } }; accessToken?: string };
    expect(saved.payload?.customer?.name).toBe("Ana Souza");
    expect(saved.accessToken).toBeUndefined();
    expect(stores.session.snapshot[await slotLinkSessionKey(token)]).toContain("access-token-teste");
  });

  it("GET 200 com status paid mostra o horário confirmado, sem botão de pagar", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) throw new Error("não deveria pagar");
      return json(200, openBody("paid"));
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByRole("heading", { name: CUSTOMER_USED_TITLE })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Pagar sinal/ })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("chave salva retoma o Pix mesmo com expiresAt vencido e não avisa", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const key = "11111111-1111-4111-8111-111111111111";
    await readOrCreatePayKey(token, stores, "2030-10-18T18:00:00.000Z", () => key, Date.parse("2030-10-01T12:00:00.000Z"));
    const sent: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        sent.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
        return json(201, payBody());
      }
      return json(200, { ...openBody("expired"), expiresAt: "2020-01-01T00:00:00.000Z" });
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByRole("button", { name: /Pagar sinal de/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Este link expirou." })).toBeNull();
    await fillAndPay(user);
    expect(await screen.findByText(/Pix 00020126580014BR.GOV.BCB.PIX/)).toBeVisible();
    expect(screen.queryByText(/expirou|já foi confirmado/i)).toBeNull();
    expect(sent).toEqual([key]);
  });

  it("com chave salva, link_expired do backend mostra expirado e apaga a chave", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const key = "22222222-2222-4222-8222-222222222222";
    await readOrCreatePayKey(token, stores, "2030-10-18T18:00:00.000Z", () => key, Date.parse("2030-10-01T12:00:00.000Z"));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe(key);
        return json(410, { error: { code: "link_expired", message: "Este link expirou." } });
      }
      return json(200, { ...openBody("pending"), expiresAt: "2020-01-01T00:00:00.000Z" });
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: "Este link expirou." })).toBeVisible();
    expect(stores.claim.snapshot[await slotLinkStorageKey(token)]).toBeUndefined();
    expect(stores.session.snapshot[await slotLinkSessionKey(token)]).toBeUndefined();
  });

  it("link antigo atualizado pede o link novo", async () => {
    const fetchImpl = vi.fn(async () => json(409, { error: { code: "link_replaced", message: "interno" } }));
    render(
      <SlotLinkCustomer
        slug="salao"
        token={token}
        timezone="America/Sao_Paulo"
        businessName="Salao da Ana"
        contactWhatsapp="+5511988887777"
        fetchImpl={fetchImpl}
        now={() => new Date("2030-10-01T12:00:00.000Z")}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Este link foi atualizado. Peça o link novo para Salao da Ana." })).toBeVisible();
    const talk = screen.getByRole("link", { name: "Falar com a loja" });
    expect(talk).toHaveAttribute("href", "https://wa.me/5511988887777");
    expect(talk).toHaveAttribute("target", "_blank");
    expect(talk.className).toMatch(/bg-pix/);
    const slots = screen.getByRole("link", { name: "Ver horários disponíveis" });
    expect(slots).toHaveAttribute("href", "/salao");
    expect(slots.className).toMatch(/border/);
    expect(slots.className).not.toMatch(/bg-pix/);
    expect(screen.queryByRole("heading", { name: "Este link não está mais disponível." })).toBeNull();
    expect(screen.queryByText("interno")).toBeNull();
  });

  it("link atualizado sem WhatsApp só oferece a agenda", async () => {
    const fetchImpl = vi.fn(async () => json(409, { error: { code: "link_replaced", message: "interno" } }));
    render(
      <SlotLinkCustomer
        slug="salao"
        token={token}
        timezone="America/Sao_Paulo"
        businessName="Salao da Ana"
        contactWhatsapp={null}
        fetchImpl={fetchImpl}
        now={() => new Date("2030-10-01T12:00:00.000Z")}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Este link foi atualizado. Peça o link novo para Salao da Ana." })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Falar com a loja" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver horários disponíveis" })).toHaveAttribute("href", "/salao");
  });

  it("link_cancelled com reason replaced continua indisponível", async () => {
    const fetchImpl = vi.fn(async () => json(409, { error: { code: "link_cancelled", message: "interno", reason: "replaced", details: { reason: "replaced" } } }));
    render(
      <SlotLinkCustomer
        slug="salao"
        token={token}
        timezone="America/Sao_Paulo"
        businessName="Salao da Ana"
        contactWhatsapp="+5511988887777"
        fetchImpl={fetchImpl}
        now={() => new Date("2030-10-01T12:00:00.000Z")}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Este link não está mais disponível." })).toBeVisible();
    expect(screen.queryByText(/foi atualizado/)).toBeNull();
  });

  it("link_cancelled sem motivo mantém a tela de cancelado", async () => {
    const fetchImpl = vi.fn(async () => json(409, { error: { code: "link_cancelled", message: "interno" } }));
    render(
      <SlotLinkCustomer
        slug="salao"
        token={token}
        timezone="America/Sao_Paulo"
        businessName="Salao da Ana"
        contactWhatsapp="+5511988887777"
        fetchImpl={fetchImpl}
        now={() => new Date("2030-10-01T12:00:00.000Z")}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Este link não está mais disponível." })).toBeVisible();
    expect(screen.queryByText(/foi atualizado/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Falar com a loja" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver horários disponíveis" })).toBeVisible();
  });

  it("403 bookings_paused pede para falar com a loja e esconde o texto do servidor", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) {
        return json(403, {
          error: {
            code: "bookings_paused",
            message: "Este estabelecimento não está aceitando novos agendamentos no momento.",
          },
        });
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" contactWhatsapp="+5511988887777" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: CUSTOMER_BOOKINGS_PAUSED })).toBeVisible();
    const talk = screen.getByRole("link", { name: "Falar com a loja" });
    expect(talk).toHaveAttribute("href", "https://wa.me/5511988887777");
    expect(talk).toHaveAttribute("target", "_blank");
    expect(talk.className).toMatch(/bg-pix-deep/);
    expect(screen.queryByText(/estabelecimento não está aceitando/)).toBeNull();
    expect(screen.queryByText(/assinatura|teste grátis|pagamento do dono/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Pagar sinal/ })).toBeNull();
  });

  it("GET 403 bookings_paused usa o WhatsApp da página", async () => {
    const fetchImpl = vi.fn(async () => json(403, { error: { code: "bookings_paused", message: "interno" } }));
    render(
      <SlotLinkCustomer
        slug="salao"
        token={token}
        timezone="America/Sao_Paulo"
        businessName="Salao da Ana"
        contactWhatsapp="+5511988887777"
        fetchImpl={fetchImpl}
        now={() => new Date("2030-10-01T12:00:00.000Z")}
      />,
    );
    expect(await screen.findByRole("heading", { name: CUSTOMER_BOOKINGS_PAUSED })).toBeVisible();
    expect(screen.getByRole("link", { name: "Falar com a loja" })).toHaveAttribute("href", "https://wa.me/5511988887777");
    expect(screen.queryByText("interno")).toBeNull();
    expect(screen.queryByText(/assinatura|teste grátis/i)).toBeNull();
  });

  it("GET 403 bookings_paused sem WhatsApp não abre link vazio", async () => {
    const fetchImpl = vi.fn(async () => json(403, { error: { code: "bookings_paused", message: "interno" } }));
    const { container } = render(
      <SlotLinkCustomer
        slug="salao"
        token={token}
        timezone="America/Sao_Paulo"
        businessName="Salao da Ana"
        contactWhatsapp=""
        fetchImpl={fetchImpl}
        now={() => new Date("2030-10-01T12:00:00.000Z")}
      />,
    );
    expect(await screen.findByRole("heading", { name: CUSTOMER_BOOKINGS_PAUSED })).toBeVisible();
    expect(screen.getByText(CUSTOMER_PAUSED_LATER)).toBeVisible();
    expect(screen.getByText(CUSTOMER_PAUSED_RECEIPT)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Falar com a loja" })).toBeNull();
    expect(container.querySelector('a[href=""], a[href="#"]')).toBeNull();
  });

  it("bookingsPaused no GET mostra a pausa, e o Pix já começado continua no formulário", async () => {
    const stores = memorySlotLinkStores();
    const paused = vi.fn(async () => json(200, { ...openBody(), bookingsPaused: true }));
    const { unmount } = render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={memorySlotLinkStores()} fetchImpl={paused} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByRole("heading", { name: CUSTOMER_BOOKINGS_PAUSED })).toBeVisible();
    expect(screen.getByRole("link", { name: "Falar com a loja" }).className).toMatch(/bg-pix-deep/);
    unmount();
    await lockPayPayload(
      token,
      stores,
      { customer: { name: "Ana Souza", phone: "+5511987654321" }, policyHash: "ab".repeat(32) },
      "2030-10-18T18:00:00.000Z",
      () => "11111111-1111-4111-8111-111111111111",
      Date.parse("2030-10-01T12:00:00.000Z"),
    );
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={paused} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByRole("button", { name: /Pagar sinal/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: CUSTOMER_BOOKINGS_PAUSED })).toBeNull();
  });

  it("GET 200 com status replaced pede o link novo da loja", async () => {
    const fetchImpl = vi.fn(async () => json(200, openBody("replaced")));
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByRole("heading", { name: "Este link foi atualizado. Peça o link novo para Salao da Ana." })).toBeVisible();
    expect(screen.getByRole("link", { name: "Falar com a loja" })).toHaveAttribute("href", "https://wa.me/5511988887777");
  });

  it("a primeira falha do Pix mantém a chave e a segunda grava outra, com nome e WhatsApp", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const keys: string[] = [];
    const now = new Date("2030-10-01T12:00:00.000Z");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
        return json(503, { error: { code: "payment_unavailable", message: "Não foi possível criar a cobrança. Tente novamente com a mesma chave." } });
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => now} />);
    await fillAndPay(user);
    const first = await screen.findByRole("alert");
    expect(first).toHaveTextContent(PIX_CREATE_FAILED_COPY);
    expect(first).not.toHaveTextContent(PIX_CREATE_FAILED_STORE);
    expect(screen.queryByText(/mesma chave/)).toBeNull();
    expect(screen.getByText("Ana Souza")).toBeVisible();
    const kept = await readPayResume(token, stores, now.getTime());
    expect(kept?.idempotencyKey).toBe(keys[0]);
    expect(kept?.payload?.customer).toEqual({ name: "Ana Souza", phone: "+5511987654321" });
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    const link = await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE });
    expect(link).toHaveAttribute("href", "https://wa.me/5511988887777");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    const rotated = await readPayResume(token, stores, now.getTime());
    expect(rotated?.idempotencyKey).not.toBe(keys[1]);
    expect(rotated?.payload?.customer).toEqual({ name: "Ana Souza", phone: "+5511987654321" });
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).toBe(rotated?.idempotencyKey);
    expect(screen.getByText("Ana Souza")).toBeVisible();
  });

  it("retry_same_key false troca na primeira falha e true mantém na segunda", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const keys: string[] = [];
    const now = new Date("2030-10-01T12:00:00.000Z");
    let posts = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        posts += 1;
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
        return json(503, {
          error: {
            code: "payment_unavailable",
            message: "Texto que não pode aparecer.",
            retry_same_key: posts === 1 ? false : true,
          },
        });
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => now} />);
    await fillAndPay(user);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(PIX_CREATE_FAILED_COPY);
    expect(alert).not.toHaveTextContent("Texto que não pode aparecer.");
    const forced = await readPayResume(token, stores, now.getTime());
    expect(forced?.idempotencyKey).not.toBe(keys[0]);
    expect(forced?.payload?.customer.name).toBe("Ana Souza");
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE });
    expect(keys[1]).toBe(forced?.idempotencyKey);
    const held = await readPayResume(token, stores, now.getTime());
    expect(held?.idempotencyKey).toBe(keys[1]);
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).toBe(keys[1]);
  });

  it("error.details.retry_same_key false troca na primeira falha e true mantém na segunda", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const keys: string[] = [];
    const message = "Não conseguimos gerar o Pix agora. Tente de novo em instantes ou fale com a loja.";
    const now = new Date("2030-10-01T12:00:00.000Z");
    let posts = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        posts += 1;
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
        return json(503, {
          error: {
            code: "payment_unavailable",
            message,
            details: { retry_same_key: posts === 1 ? false : true },
          },
        });
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => now} />);
    await fillAndPay(user);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(PIX_CREATE_FAILED_COPY);
    expect(alert).not.toHaveTextContent(message);
    expect(document.body.textContent).not.toContain(message);
    const forced = await readPayResume(token, stores, now.getTime());
    expect(forced?.idempotencyKey).not.toBe(keys[0]);
    expect(forced?.payload?.customer.name).toBe("Ana Souza");
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE });
    expect(keys[1]).toBe(forced?.idempotencyKey);
    const held = await readPayResume(token, stores, now.getTime());
    expect(held?.idempotencyKey).toBe(keys[1]);
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).toBe(keys[1]);
  });

  it("payment_unavailable mostra só a frase do front e esconde o texto do servidor", async () => {
    const serverMessage = "A cobrança foi recusada pela conta do Mercado Pago.";
    const user = userEvent.setup();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) {
        return json(503, { error: { code: "payment_unavailable", message: serverMessage } });
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={memorySlotLinkStores()} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(PIX_CREATE_FAILED_COPY);
    expect(alert).not.toHaveTextContent(serverMessage);
    expect(screen.queryByText(serverMessage)).toBeNull();
    expect(document.body.textContent).not.toContain(serverMessage);
  });

  it("duplo clique em pagar manda um único pedido", async () => {
    const stores = memorySlotLinkStores();
    let posts = 0;
    let release: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        posts += 1;
        return pending;
      }
      return json(200, openBody());
    });
    const user = userEvent.setup();
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await user.type(await screen.findByLabelText("Nome"), "Ana Souza");
    await user.type(screen.getByLabelText("WhatsApp"), "11987654321");
    await user.click(screen.getByLabelText("Li e concordo com a política"));
    const form = screen.getByTestId("slot-link-screen");
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(posts).toBe(1));
    const busy = screen.getByRole("button", { name: PIX_GENERATING_LABEL });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    release(json(503, { error: { code: "payment_unavailable", message: "Não foi possível criar a cobrança. Tente novamente com a mesma chave." } }));
    expect(await screen.findByText(PIX_CREATE_FAILED_COPY)).toBeVisible();
  });

  it("reserva com pagamento failed mostra a falha do Pix e troca a chave", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const keys: string[] = [];
    const now = new Date("2030-10-01T12:00:00.000Z");
    const failed = {
      ...payBody(),
      payment: { ...payBody().payment, status: "failed", copyPaste: null, qrCodeDataUrl: null },
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
        return json(201, failed);
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => now} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: PIX_CHARGE_FAILED_TITLE })).toBeVisible();
    expect(screen.getByText(PIX_CHARGE_FAILED_BODY)).toBeVisible();
    expectChargeFailedIcon();
    expect(screen.queryByRole("heading", { name: "Pagamento cancelado" })).toBeNull();
    const store = screen.getByRole("link", { name: TALK_TO_STORE });
    expect(store).toHaveAttribute("href", "https://wa.me/5511988887777");
    expect(store).toHaveAttribute("rel", "noopener noreferrer");
    const rotated = await readPayResume(token, stores, now.getTime());
    expect(rotated?.idempotencyKey).not.toBe(keys[0]);
    expect(rotated?.payload?.customer).toEqual({ name: "Ana Souza", phone: "+5511987654321" });
    await user.click(screen.getByRole("button", { name: PIX_CHARGE_FAILED_RETRY }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).toBe(rotated?.idempotencyKey);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("o texto antigo sem payment_unavailable não troca a chave nem a frase do Pix", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const keys: string[] = [];
    const now = new Date("2030-10-01T12:00:00.000Z");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
        return json(503, { error: { code: "internal_error", message: "Não foi possível criar a cobrança. Tente novamente com a mesma chave." } });
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => now} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: CUSTOMER_RETRY_TITLE })).toBeVisible();
    expect(screen.queryByText(PIX_CREATE_FAILED_COPY)).toBeNull();
    const stored = await readPayResume(token, stores, now.getTime());
    expect(stored?.idempotencyKey).toBe(keys[0]);
    expect(stored?.payload?.customer).toEqual({ name: "Ana Souza", phone: "+5511987654321" });
  });

  it("outro erro transitório não troca a chave guardada", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const keys: string[] = [];
    const now = new Date("2030-10-01T12:00:00.000Z");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
        return json(503, { error: { code: "internal_error", message: "interno" } });
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => now} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: CUSTOMER_RETRY_TITLE })).toBeVisible();
    const stored = await readPayResume(token, stores, now.getTime());
    expect(stored?.idempotencyKey).toBe(keys[0]);
    expect(stored?.payload?.customer).toEqual({ name: "Ana Souza", phone: "+5511987654321" });
  });

  it("segunda falha do Pix sem WhatsApp mostra a frase e omite o link", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const opened = { ...openBody(), business: { ...openBody().business, contactWhatsapp: null } };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) {
        return json(503, { error: { code: "payment_unavailable", message: "Não foi possível criar a cobrança. Tente novamente com a mesma chave." } });
      }
      return json(200, opened);
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    expect(await screen.findByText(PIX_CREATE_FAILED_STORE)).toBeVisible();
    expect(screen.queryByRole("link", { name: PIX_CREATE_FAILED_STORE })).toBeNull();
  });

  it("outro 503 continua na tela de tentar de novo", async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) return json(503, { error: { code: "internal_error", message: "interno" } });
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={memorySlotLinkStores()} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: CUSTOMER_RETRY_TITLE })).toBeVisible();
    expect(screen.queryByText(PIX_CREATE_FAILED_COPY)).toBeNull();
  });

  it("expiresAt vencido no GET deixa o formulário; link_expired do POST é que expira", async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) return json(410, { error: { code: "link_expired", message: "Este link expirou." } });
      return json(200, { ...openBody("expired"), expiresAt: "2020-01-01T00:00:00.000Z" });
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByRole("button", { name: /Pagar sinal/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Este link expirou." })).toBeNull();
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: "Este link expirou." })).toBeVisible();
  });

  it("mantém o CPF se a tentativa falhou antes da reserva e não grava o número", async () => {
    const user = userEvent.setup();
    const stores = memorySlotLinkStores();
    const bodies: string[] = [];
    let posts = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        posts += 1;
        bodies.push(String(init?.body ?? ""));
        if (posts === 1) return json(400, { error: { code: "payer_cpf_required", message: "Informe o CPF para gerar o Pix." } });
        return json(201, payBody());
      }
      return json(200, { ...openBody(), requiresPayerCpf: true });
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" stores={stores} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await user.type(await screen.findByLabelText("Nome"), "Ana Souza");
    await user.type(screen.getByLabelText("WhatsApp"), "11987654321");
    await user.type(screen.getByLabelText("CPF"), "52998224725");
    await user.click(screen.getByLabelText("Li e concordo com a política"));
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    expect(await screen.findByText(CUSTOMER_CPF_REQUIRED)).toBeVisible();
    expect(screen.getByLabelText("CPF")).toBeVisible();
    const saved = stores.claim.snapshot[await slotLinkStorageKey(token)] ?? "";
    expect(saved).not.toContain("52998224725");
    expect(saved).not.toContain("cpf");
    await user.click(screen.getByRole("button", { name: /Pagar sinal de/ }));
    expect(await screen.findByText(/Pix 00020126580014BR.GOV.BCB.PIX/)).toBeVisible();
    expect(bodies[1]).toContain("52998224725");
    expect(stores.claim.snapshot[await slotLinkStorageKey(token)] ?? "").not.toContain("52998224725");
  });

  it("429 espera 10 segundos e 5xx deixa tentar na hora, com WhatsApp só se houver", async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const { rerender } = render(
      <SlotLinkNotice
        screen={{ kind: "retry", rateLimited: true, whatsapp: "+5511988887777", publicPath: "/salao", issuedAt: 1 }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("heading", { name: CUSTOMER_RETRY_TITLE })).toBeVisible();
    expect(screen.getByText(CUSTOMER_RETRY_BODY)).toBeVisible();
    const waiting = screen.getByRole("button", { name: "Tentar de novo em 10s" });
    expect(waiting).toBeDisabled();
    expect(waiting.className).toMatch(/bg-pix/);
    const talk = screen.getByRole("link", { name: "Falar com a loja" });
    expect(talk.className).toMatch(/border/);
    expect(talk.className).not.toMatch(/bg-pix/);
    await act(async () => { vi.advanceTimersByTime(10_000); });
    const ready = screen.getByRole("button", { name: "Tentar de novo" });
    expect(ready).toBeEnabled();
    rerender(<SlotLinkNotice screen={{ kind: "retry", rateLimited: false, whatsapp: null, publicPath: "/salao", issuedAt: 2 }} onRetry={onRetry} />);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Falar com a loja" })).toBeNull();
    vi.useRealTimers();
  });
});

describe("estados e rodapé", () => {
  it("pausa sem WhatsApp pede para tentar de novo e não abre link vazio", () => {
    const { container, rerender } = render(<SlotLinkNotice screen={{ kind: "paused", whatsapp: null, publicPath: "/salao" }} />);
    for (const whatsapp of [null, "", "123", "   "]) {
      rerender(<SlotLinkNotice screen={{ kind: "paused", whatsapp, publicPath: "/salao" }} />);
      expect(screen.getByRole("heading", { name: CUSTOMER_BOOKINGS_PAUSED })).toBeVisible();
      expect(screen.getByText(CUSTOMER_PAUSED_LATER)).toBeVisible();
      expect(screen.getByText(CUSTOMER_PAUSED_RECEIPT)).toBeVisible();
      expect(screen.queryByRole("link", { name: "Falar com a loja" })).toBeNull();
      expect(container.querySelector('a[href=""], a[href="#"]')).toBeNull();
      expect(container.querySelector("a")).toBeNull();
    }
    rerender(<SlotLinkNotice screen={{ kind: "paused", whatsapp: "+5511988887777", publicPath: "/salao" }} />);
    const talk = screen.getByRole("link", { name: "Falar com a loja" });
    expect(talk).toHaveAttribute("href", "https://wa.me/5511988887777");
    expect(talk.className).toMatch(/bg-pix-deep/);
    expect(screen.getByText(CUSTOMER_PAUSED_RECEIPT)).toBeVisible();
    expect(screen.queryByText(CUSTOMER_PAUSED_LATER)).toBeNull();
  });

  it("cada estado tem título e o caminho da agenda sem o token", () => {
    const { rerender } = render(<SlotLinkNotice screen={{ kind: "taken", publicPath: "/salao" }} />);
    expect(screen.getByRole("heading", { name: "Esse horário acabou de ser reservado." })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver horários disponíveis" })).toHaveAttribute("href", "/salao");
    rerender(<SlotLinkNotice screen={{ kind: "unavailable", publicPath: "/salao" }} />);
    expect(screen.getByRole("heading", { name: "Este link não está mais disponível." })).toBeVisible();
    rerender(<SlotLinkNotice screen={{ kind: "used", publicPath: "/salao" }} />);
    expect(screen.getByRole("heading", { name: /já foi confirmado/ })).toBeVisible();
    rerender(<SlotLinkNotice screen={{ kind: "mp", whatsapp: "+5511988887777", publicPath: "/salao" }} />);
    expect(screen.getByRole("heading", { name: /não está recebendo sinal/ })).toBeVisible();
    expect(screen.getByRole("link", { name: "Falar com a loja" }).getAttribute("href")).not.toContain("h/");
  });

  it("o rodapé leva à landing com a UTM da página", () => {
    const { rerender } = render(<AgendaPixFooter campaign="pagina_publica" />);
    const link = screen.getByRole("link", { name: "Crie a sua grátis" });
    expect(link).toHaveAttribute("href", "/?utm_source=agendapix&utm_medium=rodape&utm_campaign=pagina_publica");
    expect(screen.getByText(/Agenda com sinal no Pix feita no AgendaPix/)).toBeVisible();
    rerender(<AgendaPixFooter campaign="reserva_confirmada" />);
    expect(screen.getByRole("link", { name: "Crie a sua grátis" })).toHaveAttribute("href", "/?utm_source=agendapix&utm_medium=rodape&utm_campaign=reserva_confirmada");
  });
});

describe("links enviados", () => {
  const businessId = "6b0b4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
  const pending = {
    id: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c",
    service,
    startsAt: "2030-10-18T14:30:00.000Z",
    expiresAt: "2030-10-18T14:00:00.000Z",
    status: "pending",
    createdAt: "2026-10-10T12:00:00.000Z",
    previewId: "aaaaaaaaaaaaaaaaaaaaaa",
    customerLabel: "Ana da lista",
    cancellable: true,
  };
  const paid = {
    ...pending,
    id: "8d2d6c40-3e5f-4061-8c1d-2e3f4a5b6c7d",
    status: "paid",
    customerLabel: "Segredo",
    cancellable: true,
  };

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
    }
  });

  function createdBody() {
    const nextToken = createSlotLinkToken();
    return {
      ...pending,
      id: "9e3e7d51-4f60-4172-9d2e-3f4a5b6c7d8e",
      token: nextToken,
      path: `/api/public/salao/slot-links/${nextToken}`,
      customerLabel: "Ana da lista",
      status: "pending",
    };
  }

  function renderList(post?: { status: number; body: unknown }) {
    const onReady = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/reissue") && init?.method === "POST") {
        return json(post?.status ?? 500, post?.body ?? { error: { code: "rate_limited", message: "limite" } });
      }
      return json(200, { links: [pending, paid], nextCursor: null });
    }));
    const view = render(
      <SentLinks businessId={businessId} slug="salao" date="2030-10-18" timezone="America/Sao_Paulo" onReady={onReady} />,
    );
    return { view, onReady };
  }

  it("não mostra o token e só oferece gerar de novo enquanto está pendente", async () => {
    const { view } = renderList();
    expect(await screen.findByText("Ana da lista")).toBeVisible();
    expect(screen.getByText("Aguardando pagamento")).toBeVisible();
    expect(screen.getByText("Pago, horário confirmado")).toBeVisible();
    expect(screen.queryByText("Segredo")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar link" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Gerar novo link" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Cancelar link" })).toHaveLength(1);
    const day = isoDateInZone(pending.startsAt, "America/Sao_Paulo");
    expect(screen.getAllByText(`${weekdayShort(day)}, ${formatDayMonth(day)}`).length).toBeGreaterThan(0);
    expect(view.container.textContent).not.toContain(token);
    expect(view.container.innerHTML).not.toContain("/h/");
    vi.unstubAllGlobals();
  });

  it("confirma, troca o antigo por substituído e abre o link pronto sem o token na lista", async () => {
    const user = userEvent.setup();
    const body = createdBody();
    const { view, onReady } = renderList({ status: 201, body });
    await user.click(await screen.findByRole("button", { name: "Gerar novo link" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: REISSUE_TITLE })).toBeVisible();
    expect(within(dialog).getByText(REISSUE_BODY)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Gerar novo link" }));
    expect(await screen.findByText("Substituído")).toBeVisible();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Aguardando pagamento");
    expect(within(items[0]).getByRole("button", { name: "Gerar novo link" })).toBeVisible();
    const replaced = items.find((item) => item.textContent?.includes("Substituído"));
    expect(replaced).toBeTruthy();
    expect(within(replaced as HTMLElement).queryByRole("button", { name: "Gerar novo link" })).toBeNull();
    expect(within(replaced as HTMLElement).queryByRole("button", { name: "Cancelar link" })).toBeNull();
    expect(screen.getAllByText("Aguardando pagamento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana da lista")).toHaveLength(1);
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining(`/h/${body.token}`) }));
    expect(view.container.textContent).not.toContain(body.token);
    expect(view.container.innerHTML).not.toContain("/h/");
    vi.unstubAllGlobals();
  });

  it.each([
    ["link_in_progress", 409, REISSUE_IN_PROGRESS],
    ["slot_unavailable", 409, REISSUE_TAKEN],
    ["rate_limited", 429, OWNER_NETWORK],
  ] as const)("mostra o erro %s sem trocar o link", async (code, status, message) => {
    const user = userEvent.setup();
    renderList({ status, body: { error: { code, message: "interno" } } });
    await user.click(await screen.findByRole("button", { name: "Gerar novo link" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Gerar novo link" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("Substituído")).toBeNull();
    expect(screen.getByText("Ana da lista")).toBeVisible();
    expect(within(dialog).queryByText("interno")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("erro final do reissue fica na confirmação e a lista recarrega ao fechar", async () => {
    const user = userEvent.setup();
    let gets = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/reissue") && init?.method === "POST") {
        return json(409, { error: { code: "link_used", message: "interno" } });
      }
      gets += 1;
      const listed = gets > 1 ? { ...pending, status: "paid", cancellable: false } : pending;
      return json(200, { links: [listed], nextCursor: null });
    }));
    render(<SentLinks businessId={businessId} slug="salao" date="2030-10-18" timezone="America/Sao_Paulo" onReady={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Gerar novo link" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Gerar novo link" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(REISSUE_PAID);
    expect(screen.queryByText(OWNER_NETWORK)).toBeNull();
    const before = gets;
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await vi.waitFor(() => expect(gets).toBeGreaterThan(before));
    vi.unstubAllGlobals();
  });

  it("mp_not_connected oferece conectar e o 5xx usa o texto do limite", async () => {
    const user = userEvent.setup();
    let mode: "mp" | "server" = "mp";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/reissue") && init?.method === "POST") {
        if (mode === "mp") return json(409, { error: { code: "mp_not_connected", message: "interno" } });
        return json(500, { error: { code: "internal_error", message: "interno" } });
      }
      return json(200, { links: [pending], nextCursor: null });
    }));
    render(<SentLinks businessId={businessId} slug="salao" date="2030-10-18" timezone="America/Sao_Paulo" onReady={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Gerar novo link" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Gerar novo link" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(REISSUE_MP);
    expect(within(dialog).getByRole("link", { name: CONNECT_MERCADO_PAGO })).toHaveAttribute("href", `/dashboard/settings?businessId=${businessId}#recebimento`);
    mode = "server";
    await user.click(within(dialog).getByRole("button", { name: "Gerar novo link" }));
    expect(await within(dialog).findByText(OWNER_NETWORK)).toBeVisible();
    expect(within(dialog).queryByText(REISSUE_EXPIRED)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("erro final ao cancelar fica na confirmação e recarrega ao manter", async () => {
    const user = userEvent.setup();
    let gets = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/cancel") && init?.method === "POST") {
        return json(409, { error: { code: "link_expired", message: "interno" } });
      }
      gets += 1;
      return json(200, { links: [pending], nextCursor: null });
    }));
    render(<SentLinks businessId={businessId} slug="salao" date="2030-10-18" timezone="America/Sao_Paulo" onReady={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Cancelar link" }));
    await user.click(screen.getByRole("button", { name: "Cancelar link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(CANCEL_EXPIRED);
    expect(screen.queryByText(CANCEL_PAID)).toBeNull();
    const before = gets;
    await user.click(screen.getByRole("button", { name: "Manter link" }));
    await vi.waitFor(() => expect(gets).toBeGreaterThan(before));
    vi.unstubAllGlobals();
  });
});

describe("limpeza ao abrir", () => {
  it("apaga no localStorage a chave vencida e tira o accessToken de lá", async () => {
    const claimKey = await slotLinkStorageKey(token);
    const sessionKey = await slotLinkSessionKey(token);
    window.localStorage.setItem(claimKey, JSON.stringify({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      payload: { customer: { name: "Ana Souza", phone: "+5511987654321", cpfCnpj: "52998224725" }, policyHash: "ab".repeat(32) },
      accessToken: "token-secreto",
      bookingId: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c",
      serviceId: service.id,
      expiresAt: "2099-01-01T00:00:00.000Z",
    }));
    window.localStorage.setItem(`${claimKey}vencido`, JSON.stringify({
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      expiresAt: "2020-01-01T00:00:00.000Z",
    }));
    window.sessionStorage.setItem("booking_session_salao", JSON.stringify({
      bookingId: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c",
      accessToken: "token-pix",
      expiresAt: "2020-01-01T00:00:00.000Z",
      serviceId: service.id,
    }));
    window.localStorage.setItem("booking_session_outro", JSON.stringify({
      bookingId: "7c1c5b3f-2d4e-5f60-9b0c-1d2e3f4a5b6c",
      accessToken: "token-local",
      expiresAt: "2020-01-01T00:00:00.000Z",
      serviceId: service.id,
    }));
    render(<SlotLinkStorageSweep />);
    await vi.waitFor(() => {
      expect(window.localStorage.getItem(`${claimKey}vencido`)).toBeNull();
    });
    const claim = window.localStorage.getItem(claimKey) ?? "";
    expect(claim).not.toContain("token-secreto");
    expect(claim).not.toContain("52998224725");
    expect(claim).toContain("Ana Souza");
    expect(window.sessionStorage.getItem(sessionKey)).toContain("token-secreto");
    expect(window.sessionStorage.getItem("booking_session_salao")).toBeNull();
    expect(window.localStorage.getItem("booking_session_outro")).toBeNull();
    window.localStorage.removeItem(claimKey);
    window.sessionStorage.removeItem(sessionKey);
  });
});
