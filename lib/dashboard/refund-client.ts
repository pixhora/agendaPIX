import { mapRefundFailure, parseRefundPreview, parseRefundResult, refundEndpoint, type RefundFailure, type RefundPreview, type RefundResult } from "./refund-ui";

export type RefundRead =
  | { ok: true; preview: RefundPreview }
  | { ok: false; failure: RefundFailure };

export async function fetchRefundPreview(businessId: string, bookingId: string, signal?: AbortSignal): Promise<RefundRead> {
  const response = await fetch(refundEndpoint(businessId, bookingId), {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, failure: mapRefundFailure(response.status, body) };
  const preview = parseRefundPreview(body);
  if (!preview) return { ok: false, failure: { kind: "alert", message: "Não foi possível ler a devolução. Atualize a tela." } };
  return { ok: true, preview };
}

export async function postRefund(businessId: string, bookingId: string, payload: { confirm: true; expectedAmountCents: number; requestedOn?: string }, signal?: AbortSignal): Promise<{ ok: true; result: RefundResult } | { ok: false; failure: RefundFailure }> {
  const response = await fetch(refundEndpoint(businessId, bookingId), {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, failure: mapRefundFailure(response.status, body) };
  const result = parseRefundResult(body);
  if (!result) return { ok: false, failure: { kind: "alert", message: "Não foi possível ler a resposta da devolução." } };
  return { ok: true, result };
}
