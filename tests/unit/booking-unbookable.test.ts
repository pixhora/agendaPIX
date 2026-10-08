import { describe, expect, it } from "vitest";
import {
  SERVICE_UNAVAILABLE_MESSAGE,
  depositServiceUnbookable,
  publicBookingErrorView,
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
    expect(whatsappHref("11987654321")).toBe("https://wa.me/5511987654321");
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
