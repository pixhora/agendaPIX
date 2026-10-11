import { describe, expect, it } from "vitest";
import {
  SERVICE_UNAVAILABLE_MESSAGE,
  depositServiceUnbookable,
  isPixCreateFailureBody,
  publicBookingErrorView,
  shouldRotatePixIdempotencyKey,
  whatsappHref,
} from "../../components/booking/booking-error";
import { resolvePixQr } from "../../components/booking/pix-qr";

describe("serviço com sinal sem conta conectada", () => {
  it("ignora bookable false quando o serviço não tem sinal", () => {
    expect(depositServiceUnbookable(0, false)).toBe(false);
    expect(depositServiceUnbookable(2500, false)).toBe(true);
    expect(depositServiceUnbookable(2500, undefined)).toBe(false);
  });

  it("responde 409 mp_account_not_connected com texto neutro e WhatsApp, sem o motivo", () => {
    const view = publicBookingErrorView(409, {
      error: {
        code: "mp_account_not_connected",
        reason: "mp_account_not_connected",
        message: "Conecte a conta Mercado Pago para receber o sinal.",
        contactWhatsapp: "11987654321",
      },
    });

    expect(view).toEqual({
      kind: "unavailable",
      message: SERVICE_UNAVAILABLE_MESSAGE,
      contactWhatsapp: "11987654321",
    });
    expect(view.kind === "unavailable" ? view.message : "").not.toMatch(/mercado pago|mp_account|reason/i);
  });

  it("responde 409 mp_consent_outdated com o mesmo texto neutro", () => {
    const view = publicBookingErrorView(409, {
      error: {
        code: "mp_consent_outdated",
        message: "Aceite o texto novo da devolução automática para voltar a receber sinal.",
      },
    });
    expect(view).toEqual({
      kind: "unavailable",
      message: SERVICE_UNAVAILABLE_MESSAGE,
      contactWhatsapp: null,
    });
    expect(view.kind === "unavailable" ? view.message : "").not.toMatch(/aceite o texto|mercado pago/i);
    expect(whatsappHref("11987654321")).toBe("https://wa.me/5511987654321");
  });

  it("responde 409 mp_account_test_mode com o mesmo texto neutro", () => {
    const view = publicBookingErrorView(409, {
      error: {
        code: "mp_account_test_mode",
        message: "A conta Mercado Pago conectada está em modo de teste. Conecte a conta de produção para o cliente pagar o sinal.",
      },
    });
    expect(view).toEqual({
      kind: "unavailable",
      message: SERVICE_UNAVAILABLE_MESSAGE,
      contactWhatsapp: null,
    });
    expect(view.kind === "unavailable" ? view.message : "").not.toMatch(/teste|mercado pago/i);
  });

  it("403 bookings_paused vira pausa e ignora o texto do servidor", () => {
    const view = publicBookingErrorView(403, {
      error: {
        code: "bookings_paused",
        message: "Este estabelecimento não está aceitando novos agendamentos no momento.",
      },
    });
    expect(view).toEqual({ kind: "paused" });
  });

  it("troca a falha ao criar a cobrança e esconde a chave interna", () => {
    const legacy = "Não foi possível criar a cobrança. Tente novamente com a mesma chave.";
    const view = publicBookingErrorView(503, {
      error: { code: "payment_unavailable", message: legacy },
    });
    expect(view).toEqual({ kind: "pix_create_failed", retrySameKey: null });
    expect(JSON.stringify(view)).not.toContain("mesma chave");
    const serverMessage = "A cobrança foi recusada pela conta do Mercado Pago.";
    const replaced = publicBookingErrorView(503, {
      error: { code: "payment_unavailable", message: serverMessage },
    });
    expect(replaced).toEqual({ kind: "pix_create_failed", retrySameKey: null });
    expect(JSON.stringify(replaced)).not.toContain(serverMessage);
    expect(publicBookingErrorView(503, {
      error: { code: "payment_unavailable", message: serverMessage, retry_same_key: false },
    })).toEqual({ kind: "pix_create_failed", retrySameKey: false });
    expect(publicBookingErrorView(503, {
      error: { code: "payment_unavailable", message: serverMessage, retry_same_key: true },
    })).toEqual({ kind: "pix_create_failed", retrySameKey: true });
    expect(publicBookingErrorView(503, {
      error: { code: "payment_unavailable", message: serverMessage, retry_same_key: "false" },
    })).toEqual({ kind: "pix_create_failed", retrySameKey: null });
    expect(publicBookingErrorView(503, {
      retry_same_key: false,
      error: { code: "payment_unavailable", message: serverMessage },
    })).toEqual({ kind: "pix_create_failed", retrySameKey: false });
    expect(isPixCreateFailureBody({ error: { code: "internal_error", message: legacy } })).toBe(false);
    expect(publicBookingErrorView(503, { error: { code: "internal_error", message: legacy } })).toEqual({
      kind: "message",
      message: legacy,
    });
    expect(publicBookingErrorView(503, { error: { code: "internal_error", message: "Tente de novo." } }).kind).toBe("message");
  });

  it("a primeira falha mantém a chave, a segunda troca, e retry_same_key vence", () => {
    expect(shouldRotatePixIdempotencyKey(null, 1)).toBe(false);
    expect(shouldRotatePixIdempotencyKey(null, 2)).toBe(true);
    expect(shouldRotatePixIdempotencyKey(null, 3)).toBe(true);
    expect(shouldRotatePixIdempotencyKey(true, 2)).toBe(false);
    expect(shouldRotatePixIdempotencyKey(false, 1)).toBe(true);
  });

  it("não trata payout_key_missing como indisponível", () => {
    const view = publicBookingErrorView(409, {
      error: { code: "payout_key_missing", message: "Falta a chave de repasse." },
    });
    expect(view.kind).toBe("message");
    if (view.kind === "message") expect(view.message).toBe("Falta a chave de repasse.");
  });
});

describe("QR do Pix continua data:, blob: ou SVG local", () => {
  it("aceita o PNG em data URL que o backend já envia e recusa host externo", () => {
    expect(resolvePixQr("data:image/png;base64,abc")?.kind).toBe("src");
    expect(resolvePixQr("https://cdn.example/qr.png")).toBeNull();
    const svg = resolvePixQr("<svg><script>alert(1)</script><path d=\"M0 0\"/></svg>");
    expect(svg?.kind).toBe("svg");
    if (svg?.kind === "svg") expect(svg.svg).not.toMatch(/script|alert/i);
  });
});
