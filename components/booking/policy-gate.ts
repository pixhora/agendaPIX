import type { DepositPolicy, PolicyChangedUpdate, PolicyDetailLine, PublicService } from "./types";

/**
 * `none`: sem sinal.
 * `legacy`: a API ainda não manda política (os dois campos ausentes). Não bloqueia o Pix e não inventa texto.
 * `ready`: resumo e hash vieram preenchidos.
 * `missing`: o servidor começou a mandar a política, mas falta resumo ou hash.
 */
export function servicePolicyState(service: Pick<PublicService, "depositCents" | "policySummary" | "policyHash">): "none" | "legacy" | "ready" | "missing" {
  if (service.depositCents <= 0) return "none";
  if (service.policySummary === undefined && service.policyHash === undefined) return "legacy";
  if (!service.policySummary?.trim() || !service.policyHash?.trim()) return "missing";
  return "ready";
}

/**
 * Tom visual da linha. Não escreve a política: só compara o horário com `refundUntilHours` do servidor.
 * Sem política ou sem horário, fica no tom normal.
 */
export function policyLineTone(
  policy: Pick<DepositPolicy, "refundUntilHours"> | null | undefined,
  startsAt: string | null | undefined,
  now = Date.now(),
): "ok" | "warn" {
  const hours = policy?.refundUntilHours;
  if (hours == null || !startsAt) return "ok";
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) return "ok";
  return start - now <= hours * 3_600_000 ? "warn" : "ok";
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readDetails(value: unknown): PolicyDetailLine[] | null {
  if (!Array.isArray(value)) return null;
  const lines: PolicyDetailLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const title = readString((item as { title?: unknown }).title);
    const body = readString((item as { body?: unknown }).body);
    if (!title || !body) continue;
    const tone = (item as { tone?: unknown }).tone;
    lines.push({ title, body, tone: tone === "warn" || tone === "ok" ? tone : undefined });
  }
  return lines.length > 0 ? lines : null;
}

function readDepositPolicy(value: unknown): DepositPolicy | null {
  if (!value || typeof value !== "object") return null;
  return value as DepositPolicy;
}

/** Lê a política nova de um `409 policy_changed`. Não inventa texto se o campo não veio. */
export function readPolicyChangedUpdate(body: unknown): PolicyChangedUpdate | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const error = root.error && typeof root.error === "object" ? (root.error as Record<string, unknown>) : null;
  const code = error?.code;
  if (code !== "policy_changed") return null;
  const nested = error?.policy && typeof error.policy === "object" ? (error.policy as Record<string, unknown>) : null;
  const source = error ?? {};
  return {
    policySummary: readString(source.policySummary) ?? readString(nested?.policySummary),
    policyHash: readString(source.policyHash) ?? readString(nested?.policyHash),
    depositPolicy: readDepositPolicy(source.depositPolicy) ?? readDepositPolicy(nested?.snapshot) ?? readDepositPolicy(nested?.depositPolicy),
    policyDetails: readDetails(source.policyDetails) ?? readDetails(nested?.details) ?? readDetails(nested?.policyDetails),
  };
}
