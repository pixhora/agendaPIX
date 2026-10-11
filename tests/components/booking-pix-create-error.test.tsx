// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { PIX_CHARGE_FAILED_BODY, PIX_CHARGE_FAILED_RETRY, PIX_CHARGE_FAILED_TITLE, PIX_CREATE_FAILED_COPY, PIX_CREATE_FAILED_STORE, PIX_GENERATING_LABEL, TALK_TO_STORE } from "@/components/booking/customer-copy";
import { EXPIRED_PIX_TITLE } from "@/components/booking/pix-deadline-copy";

const slug = "studio-tatuarte";
const serviceId = "00000000-0000-4000-8000-0000000000c2";
const legacy = "Não foi possível criar a cobrança. Tente novamente com a mesma chave.";

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
  vi.unstubAllGlobals();
});

function business(contactWhatsapp: string | null) {
  return {
    name: "Studio Tatuarte",
    timezone: "America/Sao_Paulo",
    contactWhatsapp,
    phone: null,
    requiresPayerCpf: false,
    services: [{
      id: serviceId,
      name: "Corte",
      durationMinutes: 30,
      priceCents: 5000,
      depositCents: 50,
      bookable: true,
    }],
  };
}

function availability(url: string) {
  const parsed = new URL(url, "http://localhost");
  const dates = (parsed.searchParams.get("dates") ?? parsed.searchParams.get("date") ?? "").split(",").filter(Boolean);
  const days = dates.map((date) => ({
    date,
    slots: [{ startsAt: `${date}T18:00:00.000Z`, endsAt: `${date}T18:30:00.000Z` }],
  }));
  return new Response(JSON.stringify({ timezone: "America/Sao_Paulo", slots: days[0]?.slots ?? [], days, bookingsPaused: false }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function failTwice(contactWhatsapp: string | null) {
  const user = userEvent.setup();
  const keys: string[] = [];
  const names: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
      names.push(JSON.parse(String(init.body)).customer.name as string);
      return new Response(JSON.stringify({ error: { code: "payment_unavailable", message: legacy } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`pedido inesperado: ${url}`);
  }));

  render(<BookingFlow slug={slug} previewBusiness={business(contactWhatsapp)} legalPagesPublished />);
  await user.click(await screen.findByRole("radio", { name: /Corte/ }));
  await user.click(screen.getByRole("button", { name: "Escolher horário" }));
  await user.click(await screen.findByRole("radio", { name: "15:00" }));
  await user.click(screen.getByRole("button", { name: "Continuar com 15:00" }));
  await user.type(screen.getByLabelText("Seu nome"), "Matheus");
  await user.type(screen.getByLabelText("WhatsApp"), "14997504655");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  return { user, keys, names };
}

it("payment_unavailable mostra só a frase do front e esconde o texto do servidor", async () => {
  const serverMessage = "A cobrança foi recusada pela conta do Mercado Pago.";
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      return new Response(JSON.stringify({ error: { code: "payment_unavailable", message: serverMessage } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`pedido inesperado: ${url}`);
  }));
  render(<BookingFlow slug={slug} previewBusiness={business("+5514997504655")} legalPagesPublished />);
  await user.click(await screen.findByRole("radio", { name: /Corte/ }));
  await user.click(screen.getByRole("button", { name: "Escolher horário" }));
  await user.click(await screen.findByRole("radio", { name: "15:00" }));
  await user.click(screen.getByRole("button", { name: "Continuar com 15:00" }));
  await user.type(screen.getByLabelText("Seu nome"), "Matheus");
  await user.type(screen.getByLabelText("WhatsApp"), "14997504655");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(PIX_CREATE_FAILED_COPY);
  expect(alert).not.toHaveTextContent(serverMessage);
  expect(screen.queryByText(serverMessage)).toBeNull();
  expect(document.body.textContent).not.toContain(serverMessage);
});

it("na primeira falha explica o Pix e mantém a chave", async () => {
  const { keys, names } = await failTwice("+5514997504655");
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(PIX_CREATE_FAILED_COPY);
  expect(alert).not.toHaveTextContent(PIX_CREATE_FAILED_STORE);
  expect(alert).not.toHaveTextContent("mesma chave");
  expect(screen.getByLabelText("Seu nome")).toHaveValue("Matheus");
  expect(keys).toEqual([expect.any(String)]);
  expect(names).toEqual(["Matheus"]);
});

it("na segunda falha aponta o WhatsApp da loja e manda outra chave", async () => {
  const { user, keys, names } = await failTwice("+5514997504655");
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  const link = await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE });
  expect(link).toHaveAttribute("href", "https://wa.me/5514997504655");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByRole("alert")).toHaveTextContent(PIX_CREATE_FAILED_COPY);
  expect(screen.getByLabelText("Seu nome")).toHaveValue("Matheus");
  expect(screen.getByLabelText("WhatsApp")).toHaveValue("(14) 99750-4655");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  expect(await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE })).toBeVisible();
  expect(keys).toHaveLength(3);
  expect(keys[2]).not.toBe(keys[0]);
  expect(keys[2]).toMatch(/^[0-9a-f-]{36}$/i);
  expect(names).toEqual(["Matheus", "Matheus", "Matheus"]);
});

it("na segunda falha sem WhatsApp mostra a frase e omite o link", async () => {
  const { user, keys } = await failTwice(null);
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  expect(await screen.findByText(PIX_CREATE_FAILED_STORE)).toBeVisible();
  expect(screen.queryByRole("link", { name: PIX_CREATE_FAILED_STORE })).toBeNull();
  expect(keys[0]).toBe(keys[1]);
});

it("retry_same_key false troca na primeira falha e true mantém na segunda", async () => {
  const user = userEvent.setup();
  const keys: string[] = [];
  let posts = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      posts += 1;
      keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
      const retrySameKey = posts === 1 ? false : true;
      return new Response(JSON.stringify({
        error: { code: "payment_unavailable", message: "Texto que não pode aparecer.", retry_same_key: retrySameKey },
      }), { status: 503, headers: { "content-type": "application/json" } });
    }
    throw new Error(`pedido inesperado: ${url}`);
  }));
  render(<BookingFlow slug={slug} previewBusiness={business("+5514997504655")} legalPagesPublished />);
  await user.click(await screen.findByRole("radio", { name: /Corte/ }));
  await user.click(screen.getByRole("button", { name: "Escolher horário" }));
  await user.click(await screen.findByRole("radio", { name: "15:00" }));
  await user.click(screen.getByRole("button", { name: "Continuar com 15:00" }));
  await user.type(screen.getByLabelText("Seu nome"), "Matheus");
  await user.type(screen.getByLabelText("WhatsApp"), "14997504655");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(PIX_CREATE_FAILED_COPY);
  expect(alert).not.toHaveTextContent("Texto que não pode aparecer.");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE });
  expect(keys[1]).not.toBe(keys[0]);
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE });
  expect(keys).toHaveLength(3);
  expect(keys[2]).toBe(keys[1]);
});

it("error.details.retry_same_key false troca na primeira falha e true mantém na segunda", async () => {
  const user = userEvent.setup();
  const keys: string[] = [];
  const message = "Não conseguimos gerar o Pix agora. Tente de novo em instantes ou fale com a loja.";
  let posts = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      posts += 1;
      keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
      return new Response(JSON.stringify({
        error: {
          code: "payment_unavailable",
          message,
          details: { retry_same_key: posts === 1 ? false : true },
        },
      }), { status: 503, headers: { "content-type": "application/json" } });
    }
    throw new Error(`pedido inesperado: ${url}`);
  }));
  render(<BookingFlow slug={slug} previewBusiness={business("+5514997504655")} legalPagesPublished />);
  await user.click(await screen.findByRole("radio", { name: /Corte/ }));
  await user.click(screen.getByRole("button", { name: "Escolher horário" }));
  await user.click(await screen.findByRole("radio", { name: "15:00" }));
  await user.click(screen.getByRole("button", { name: "Continuar com 15:00" }));
  await user.type(screen.getByLabelText("Seu nome"), "Matheus");
  await user.type(screen.getByLabelText("WhatsApp"), "14997504655");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(PIX_CREATE_FAILED_COPY);
  expect(alert).not.toHaveTextContent(message);
  expect(document.body.textContent).not.toContain(message);
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE });
  expect(keys[1]).not.toBe(keys[0]);
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  await screen.findByRole("link", { name: PIX_CREATE_FAILED_STORE });
  expect(keys).toHaveLength(3);
  expect(keys[2]).toBe(keys[1]);
});

it("o texto antigo sem payment_unavailable não troca a chave nem a frase do Pix", async () => {
  const user = userEvent.setup();
  const keys: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
      return new Response(JSON.stringify({ error: { code: "internal_error", message: legacy } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`pedido inesperado: ${url}`);
  }));
  render(<BookingFlow slug={slug} previewBusiness={business("+5514997504655")} legalPagesPublished />);
  await user.click(await screen.findByRole("radio", { name: /Corte/ }));
  await user.click(screen.getByRole("button", { name: "Escolher horário" }));
  await user.click(await screen.findByRole("radio", { name: "15:00" }));
  await user.click(screen.getByRole("button", { name: "Continuar com 15:00" }));
  await user.type(screen.getByLabelText("Seu nome"), "Matheus");
  await user.type(screen.getByLabelText("WhatsApp"), "14997504655");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(legacy);
  expect(alert).not.toHaveTextContent(PIX_CREATE_FAILED_COPY);
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(legacy);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(screen.getByLabelText("Seu nome")).toHaveValue("Matheus");
});

it("outro erro transitório repete a mesma chave", async () => {
  const user = userEvent.setup();
  const keys: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
      return new Response(JSON.stringify({ error: { code: "internal_error", message: "Tente de novo." } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`pedido inesperado: ${url}`);
  }));
  render(<BookingFlow slug={slug} previewBusiness={business("+5514997504655")} legalPagesPublished />);
  await user.click(await screen.findByRole("radio", { name: /Corte/ }));
  await user.click(screen.getByRole("button", { name: "Escolher horário" }));
  await user.click(await screen.findByRole("radio", { name: "15:00" }));
  await user.click(screen.getByRole("button", { name: "Continuar com 15:00" }));
  await user.type(screen.getByLabelText("Seu nome"), "Matheus");
  await user.type(screen.getByLabelText("WhatsApp"), "14997504655");
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Tente de novo.");
  expect(screen.queryByText(PIX_CREATE_FAILED_COPY)).toBeNull();
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Tente de novo.");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(screen.getByLabelText("Seu nome")).toHaveValue("Matheus");
});

function createdBooking(paymentStatus: "failed" | "cancelled" | "expired") {
  return {
    bookingId: "00000000-0000-4000-8000-0000000000c1",
    status: "pending_payment",
    startsAt: "2030-10-18T18:00:00.000Z",
    endsAt: "2030-10-18T18:30:00.000Z",
    expiresAt: "2030-10-18T17:30:00.000Z",
    accessToken: "token-pix",
    payment: {
      id: "00000000-0000-4000-8000-0000000000c3",
      provider: "fake",
      externalId: null,
      amountCents: 50,
      status: paymentStatus,
      expiresAt: "2030-10-18T17:30:00.000Z",
      qrCodeDataUrl: null,
      copyPaste: null,
    },
    policy: null,
  };
}

async function reachGenerate(user: ReturnType<typeof userEvent.setup>) {
  render(<BookingFlow slug={slug} previewBusiness={business("+5514997504655")} legalPagesPublished />);
  await user.click(await screen.findByRole("radio", { name: /Corte/ }));
  await user.click(screen.getByRole("button", { name: "Escolher horário" }));
  await user.click(await screen.findByRole("radio", { name: "15:00" }));
  await user.click(screen.getByRole("button", { name: "Continuar com 15:00" }));
  await user.type(screen.getByLabelText("Seu nome"), "Matheus");
  await user.type(screen.getByLabelText("WhatsApp"), "14997504655");
  return screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ });
}

it("duplo clique em Gerar Pix manda um único pedido", async () => {
  const user = userEvent.setup();
  let posts = 0;
  let release: (value: Response) => void = () => {};
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      posts += 1;
      return pending;
    }
    throw new Error(`pedido inesperado: ${url}`);
  }));
  const button = await reachGenerate(user);
  await act(async () => {
    button.click();
    button.click();
  });
  expect(posts).toBe(1);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(button).toHaveTextContent(PIX_GENERATING_LABEL);
  release(new Response(JSON.stringify({ error: { code: "payment_unavailable", message: legacy } }), {
    status: 503,
    headers: { "content-type": "application/json" },
  }));
  expect(await screen.findByText(PIX_CREATE_FAILED_COPY)).toBeVisible();
});

it("reserva com pagamento failed mostra a falha do Pix e troca a chave", async () => {
  const user = userEvent.setup();
  const keys: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
      return new Response(JSON.stringify(createdBooking("failed")), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/payment")) return new Response(JSON.stringify(createdBooking("failed")), { status: 200 });
    throw new Error(`pedido inesperado: ${url}`);
  }));
  await reachGenerate(user);
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  expect(await screen.findByRole("heading", { name: PIX_CHARGE_FAILED_TITLE })).toBeVisible();
  expect(screen.getByText(PIX_CHARGE_FAILED_BODY)).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Pagamento cancelado" })).toBeNull();
  const store = screen.getByRole("link", { name: TALK_TO_STORE });
  expect(store).toHaveAttribute("href", "https://wa.me/5514997504655");
  expect(store).toHaveAttribute("rel", "noopener noreferrer");
  await user.click(screen.getByRole("button", { name: PIX_CHARGE_FAILED_RETRY }));
  expect(await screen.findByRole("heading", { name: PIX_CHARGE_FAILED_TITLE })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
  expect(keys[1]).toMatch(/^[0-9a-f-]{36}$/i);
});

it("pagamento cancelado continua na tela de cobrança cancelada", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      return new Response(JSON.stringify(createdBooking("cancelled")), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`pedido inesperado: ${url}`);
  }));
  await reachGenerate(user);
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  expect(await screen.findByRole("heading", { name: "Pagamento cancelado" })).toBeVisible();
  expect(screen.getByText(/Esta cobrança Pix foi cancelada/)).toBeVisible();
  expect(screen.queryByRole("heading", { name: PIX_CHARGE_FAILED_TITLE })).toBeNull();
});

it("pagamento expirado não vira a falha de gerar o Pix", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) return availability(url);
    if (url.includes("/bookings") && init?.method === "POST") {
      return new Response(JSON.stringify(createdBooking("expired")), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/payment")) return new Response(JSON.stringify(createdBooking("expired")), { status: 200 });
    throw new Error(`pedido inesperado: ${url}`);
  }));
  await reachGenerate(user);
  await user.click(screen.getByRole("button", { name: /Gerar Pix de R\$\s*0,50/ }));
  expect(await screen.findByRole("heading", { name: EXPIRED_PIX_TITLE })).toBeVisible();
  expect(screen.queryByRole("heading", { name: PIX_CHARGE_FAILED_TITLE })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Pagamento cancelado" })).toBeNull();
});
