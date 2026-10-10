// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlotLinkCustomer } from "@/components/slot-link/slot-link-customer";
import { AgendaPixFooter } from "@/components/slot-link/agenda-pix-footer";
import { SlotLinkNotice } from "@/components/slot-link/slot-link-notice";
import { memoryPayKeyStore, readOrCreatePayKey, slotLinkStorageKey } from "@/lib/slot-link/idempotency";
import { createSlotLinkToken } from "../../lib/bookings/slot-link-token";
import { CUSTOMER_IN_PROGRESS, CUSTOMER_USED_TITLE } from "@/lib/slot-link/copy";

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
    const store = memoryPayKeyStore();
    const keys: string[] = [];
    let posts = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        posts += 1;
        const headers = init?.headers as Record<string, string>;
        keys.push(headers["Idempotency-Key"]);
        if (posts === 1) throw new TypeError("Failed to fetch");
        return json(201, payBody());
      }
      return json(200, openBody());
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" store={store} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByLabelText("Nome")).toHaveValue("");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("");
    expect(screen.queryByLabelText("CPF")).toBeNull();
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: "Sem conexão. Verifique sua internet e tente de novo." })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await user.click(await screen.findByRole("button", { name: /Pagar sinal de/ }));
    expect(await screen.findByText(/Pix 00020126580014BR.GOV.BCB.PIX/)).toBeVisible();
    expect(screen.queryByText(/já foi confirmado|já usado|link_used/i)).toBeNull();
    expect(keys).toEqual([keys[0], keys[0]]);
    expect(keys[0]?.length).toBeGreaterThan(8);
    const saved = store.snapshot[await slotLinkStorageKey(token)] ?? "";
    expect(saved.includes(token)).toBe(false);
  });

  it("chave diferente com marcação ativa mostra link_in_progress, sem contador e sem dado da outra cliente", async () => {
    const user = userEvent.setup();
    const store = memoryPayKeyStore();
    await readOrCreatePayKey(token, memoryPayKeyStore(), () => "chave-do-outro-aparelho");
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
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" store={store} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: CUSTOMER_IN_PROGRESS })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver horários disponíveis" })).toHaveAttribute("href", "/salao");
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText(/\+5511911112222|1111/)).toBeNull();
  });

  it("apaga a chave quando o pagamento confirma e quando o link expira", async () => {
    const user = userEvent.setup();
    const store = memoryPayKeyStore();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) return json(201, payBody());
      return json(200, openBody());
    });
    const view = render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" store={store} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByText(/Pix 000201/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Simular pagamento confirmado" }));
    expect(await screen.findByText("Horário confirmado!")).toBeVisible();
    expect(store.snapshot[await slotLinkStorageKey(token)]).toBeUndefined();

    const expiredStore = memoryPayKeyStore();
    await readOrCreatePayKey(token, expiredStore, () => "chave-velha");
    view.rerender(
      <SlotLinkCustomer
        slug="salao"
        token={token}
        timezone="America/Sao_Paulo"
        store={expiredStore}
        fetchImpl={vi.fn(async () => json(410, { error: { code: "link_expired", message: "Este link expirou." } }))}
        now={() => new Date("2030-10-01T12:00:00.000Z")}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Este link expirou." })).toBeVisible();
    expect(expiredStore.snapshot[await slotLinkStorageKey(token)]).toBeUndefined();
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
    const store = memoryPayKeyStore();
    const key = "11111111-1111-4111-8111-111111111111";
    await readOrCreatePayKey(token, store, () => key);
    const sent: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        sent.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
        return json(201, payBody());
      }
      return json(200, { ...openBody("expired"), expiresAt: "2020-01-01T00:00:00.000Z" });
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" store={store} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByRole("button", { name: /Pagar sinal de/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Este link expirou." })).toBeNull();
    await fillAndPay(user);
    expect(await screen.findByText(/Pix 00020126580014BR.GOV.BCB.PIX/)).toBeVisible();
    expect(screen.queryByText(/expirou|já foi confirmado/i)).toBeNull();
    expect(sent).toEqual([key]);
  });

  it("com chave salva, link_expired do backend mostra expirado e apaga a chave", async () => {
    const user = userEvent.setup();
    const store = memoryPayKeyStore();
    const key = "22222222-2222-4222-8222-222222222222";
    await readOrCreatePayKey(token, store, () => key);
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pay")) {
        expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe(key);
        return json(410, { error: { code: "link_expired", message: "Este link expirou." } });
      }
      return json(200, { ...openBody("pending"), expiresAt: "2020-01-01T00:00:00.000Z" });
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" store={store} fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    await fillAndPay(user);
    expect(await screen.findByRole("heading", { name: "Este link expirou." })).toBeVisible();
    expect(store.snapshot[await slotLinkStorageKey(token)]).toBeUndefined();
  });

  it("sem chave salva, expiresAt vencido não chama o pay", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/pay")) throw new Error("não deveria pagar");
      return json(200, { ...openBody("pending"), expiresAt: "2020-01-01T00:00:00.000Z" });
    });
    render(<SlotLinkCustomer slug="salao" token={token} timezone="America/Sao_Paulo" fetchImpl={fetchImpl} now={() => new Date("2030-10-01T12:00:00.000Z")} />);
    expect(await screen.findByRole("heading", { name: "Este link expirou." })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Pagar sinal/ })).toBeNull();
  });
});

describe("estados e rodapé", () => {
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
