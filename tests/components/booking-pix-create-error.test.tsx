// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { PIX_CREATE_FAILED_COPY, PIX_CREATE_FAILED_STORE } from "@/components/booking/customer-copy";

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
