import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { businessLoadCopy } from "../../components/booking/booking-error";
import {
  BUSINESS_LOAD_COPY,
  BUSINESS_NOT_FOUND_COPY,
  BUSINESS_SLOW_COPY,
  REFUNDED_TITLE,
  REFUND_PENDING_TITLE,
  PIX_CREATE_FAILED_COPY,
  PIX_CREATE_FAILED_STORE,
  SLOTS_LOAD_COPY,
  SUBMIT_RETRY_COPY,
  refundPendingBody,
  refundedBody,
} from "../../components/booking/customer-copy";
import { expiredScreenBody } from "../../components/booking/pix-deadline-copy";
import { pixUiPhase } from "../../components/booking/pix-status";

function bookingSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return bookingSources(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

describe("textos da tela de Pix e de erro", () => {
  it("mantém a frase da política quando o prazo acaba e depois da conferência", () => {
    expect(expiredScreenBody(true, null)).toContain("não puder ser mantido");
    expect(expiredScreenBody(false, null)).toContain("não puder ser mantido");
    expect(expiredScreenBody(false, "refund")).toContain("o valor é devolvido para a conta que fez o Pix");
    expect(expiredScreenBody(true, "rebook_if_free")).toContain("Se o horário continuar livre");
  });

  it("não usa a palavra automaticamente na cópia do cliente", () => {
    const hits = bookingSources("components/booking").flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return /automaticamente/i.test(source) ? [file] : [];
    });
    expect(hits).toEqual([]);
  });

  it("separa devolução pendente e devolvida, sem tom de sucesso", () => {
    expect(REFUND_PENDING_TITLE).toBe("Pagamento em devolução");
    expect(REFUNDED_TITLE).toBe("Pagamento devolvido");
    expect(refundPendingBody("R$ 20,00")).toBe(
      "Seu Pix chegou depois que o horário foi liberado. Estamos devolvendo R$ 20,00 para a conta que fez o pagamento.",
    );
    expect(refundedBody("R$ 20,00")).toBe(
      "Devolvemos R$ 20,00 para a conta que fez o Pix. Confira no extrato do seu banco.",
    );
  });

  it("usa frases fixas no lugar da mensagem crua", () => {
    expect(SLOTS_LOAD_COPY).toBe("Não foi possível carregar os horários. Tente de novo em instantes.");
    expect(SUBMIT_RETRY_COPY).toBe("Não conseguimos concluir agora. Tente de novo em instantes.");
    const raw = new Error("column bookings.foo does not exist");
    expect(businessLoadCopy(raw)).toBe(BUSINESS_LOAD_COPY);
    expect(businessLoadCopy(raw)).not.toContain("column");
    const missing = new Error("not_found");
    missing.name = "PublicLoadError";
    expect(businessLoadCopy(missing)).toBe(BUSINESS_NOT_FOUND_COPY);
    const slow = new Error("The operation was aborted");
    slow.name = "AbortError";
    expect(businessLoadCopy(slow)).toBe(BUSINESS_SLOW_COPY);
  });

  it("explica a falha do Pix sem citar a chave interna", () => {
    expect(PIX_CREATE_FAILED_COPY).toBe("Não conseguimos gerar o Pix agora. Seus dados continuam salvos, é só tocar em Gerar Pix de novo.");
    expect(PIX_CREATE_FAILED_STORE).toBe("Se continuar, fale com a loja");
    expect(PIX_CREATE_FAILED_COPY).not.toMatch(/chave/i);
    const roots = ["components", "app"];
    const hits = roots.flatMap((root) => bookingSources(root).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("Não foi possível criar a cobrança. Tente novamente com a mesma chave.") ? [file] : [];
    }));
    expect(hits).toEqual([]);
  });
});

describe("reserva vencida não vira confirmação", () => {
  it("prioriza a reserva quando o Pix já está pago", () => {
    for (const status of ["expired", "cancelled"] as const) {
      expect(pixUiPhase({ status, payment: { status: "paid" } as never })).not.toBe("paid");
    }
    expect(pixUiPhase({ status: "expired", payment: { status: "paid" } as never })).toBe("refund_pending");
    expect(pixUiPhase({ status: "cancelled", payment: { status: "paid" } as never })).toBe("refund_pending");
    expect(pixUiPhase({ status: "expired", payment: { status: "refunded" } as never })).toBe("refunded");
    expect(pixUiPhase({ status: "cancelled", payment: { status: "refund_pending" } as never })).toBe("refund_pending");
    expect(pixUiPhase({ status: "confirmed", payment: { status: "paid" } as never })).toBe("paid");
    expect(pixUiPhase({ status: "completed", payment: { status: "paid" } as never })).toBe("paid");
  });
});
