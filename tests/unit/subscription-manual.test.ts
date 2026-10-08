import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { subscriptionProviderIds } from "../../db/schema";
import { subscriptionCheckoutBlocked, SUBSCRIPTION_RENEWAL_LEAD_DAYS } from "../../lib/billing/access";
import { parseActivateArgs, runActivateCli, runListRequestsCli } from "../../lib/billing/cli";
import { readManualCheckoutConfig } from "../../lib/billing/config";
import { addCalendarMonths } from "../../lib/billing/period";
import { registeredSubscriptionProvider, registeredSubscriptionProviderIds } from "../../lib/billing/providers";
import { readPlatformSubscriptionAccessToken } from "../../lib/billing/providers/pix-platform";
import { manualWhatsappUrl, publicBusinessPageUrl, subscriptionWhatsappText } from "../../lib/billing/public-url";
import { requestWantsJson, subscriptionCheckoutResponse } from "../../lib/billing/checkout";

const timezone = "America/Sao_Paulo";
const now = new Date("2026-10-08T15:00:00.000Z");
const fictionalNumber = "5500000000000";
const env = { SUPPORT_WHATSAPP_NUMBER: fictionalNumber, SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "5", BETTER_AUTH_URL: "http://localhost:3000" };

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

function codeWithoutComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

describe("config da ativação manual", () => {
  it("não tem padrão e aceita só dígitos e horas inteiras", () => {
    expect(readManualCheckoutConfig({})).toEqual({ available: false, unavailableReason: "config_missing", whatsappNumber: null, activationHours: null });
    expect(readManualCheckoutConfig({ SUPPORT_WHATSAPP_NUMBER: fictionalNumber })).toMatchObject({ available: false });
    expect(readManualCheckoutConfig({ ...env, SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "0" }).available).toBe(false);
    expect(readManualCheckoutConfig({ ...env, SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "02" }).available).toBe(false);
    expect(readManualCheckoutConfig({ ...env, SUBSCRIPTION_MANUAL_ACTIVATION_HOURS: "1.5" }).available).toBe(false);
    expect(readManualCheckoutConfig({ ...env, SUPPORT_WHATSAPP_NUMBER: `+${fictionalNumber}` }).available).toBe(false);
    expect(readManualCheckoutConfig({ ...env, SUPPORT_WHATSAPP_NUMBER: "123" }).available).toBe(false);
    expect(readManualCheckoutConfig(env)).toEqual({ available: true, whatsappNumber: fictionalNumber, activationHours: 5 });
  });
});

describe("WhatsApp e janela de renovação", () => {
  it("monta a mensagem com a URL pública codificada uma vez", () => {
    const publicUrl = publicBusinessPageUrl("salao-da-ana", env);
    expect(publicUrl).toBe("http://localhost:3000/salao-da-ana");
    const text = subscriptionWhatsappText(publicUrl!);
    expect(text).toBe("Quero assinar o AgendaPix. Meu link: http://localhost:3000/salao-da-ana");
    expect(manualWhatsappUrl(fictionalNumber, publicUrl!)).toBe(`https://wa.me/${fictionalNumber}?text=${encodeURIComponent(text)}`);
    expect(publicBusinessPageUrl("salao-da-ana", {})).toBeNull();
  });

  it("bloqueia o checkout só com assinatura active e mais de 3 dias", () => {
    expect(SUBSCRIPTION_RENEWAL_LEAD_DAYS).toBe(3);
    const active = (iso: string) => ({ status: "active" as const, currentPeriodEnd: new Date(iso) });
    expect(subscriptionCheckoutBlocked(active("2026-10-13T02:59:59.000Z"), timezone, now)).toBe(true);
    expect(subscriptionCheckoutBlocked(active("2026-10-12T02:59:59.000Z"), timezone, now)).toBe(false);
    expect(subscriptionCheckoutBlocked(active("2026-10-01T02:59:59.000Z"), timezone, now)).toBe(false);
    expect(subscriptionCheckoutBlocked({ status: "active", currentPeriodEnd: null }, timezone, now)).toBe(false);
    expect(subscriptionCheckoutBlocked({ status: "trialing", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") }, timezone, now)).toBe(false);
    expect(subscriptionCheckoutBlocked({ status: "past_due", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") }, timezone, now)).toBe(false);
    expect(subscriptionCheckoutBlocked(null, timezone, now)).toBe(false);
  });

  it("soma meses no fuso do negócio", () => {
    expect(addCalendarMonths(new Date("2026-01-31T18:30:00.000Z"), 1, timezone).toISOString()).toBe("2026-02-28T18:30:00.000Z");
    expect(addCalendarMonths(new Date("2026-11-19T02:59:59.000Z"), 1, timezone).toISOString()).toBe("2026-12-19T02:59:59.000Z");
  });
});

describe("provedor da assinatura", () => {
  it("registra só o manual e o pix da plataforma não lê token de dono", () => {
    expect(registeredSubscriptionProviderIds()).toEqual(["manual"]);
    expect(subscriptionProviderIds).toEqual(["manual", "pix_platform"]);
    expect(registeredSubscriptionProvider("manual")?.id).toBe("manual");
    expect(registeredSubscriptionProvider("pix_platform")).toBeNull();
    expect(registeredSubscriptionProvider("manual", env)?.isAvailable()).toBe(true);
    expect(registeredSubscriptionProvider("manual", {})?.isAvailable()).toBe(false);
    expect(readPlatformSubscriptionAccessToken({ MERCADOPAGO_ACCESS_TOKEN: "platform-token-test", OWNER_OAUTH_ACCESS_TOKEN: "owner-token-test" })).toBe("platform-token-test");
    expect(readPlatformSubscriptionAccessToken({ MERCADOPAGO_ACCESS_TOKEN: "replace-this-platform" })).toBeNull();
    expect(readPlatformSubscriptionAccessToken({})).toBeNull();

    const billingRoot = join(import.meta.dirname, "../../lib/billing");
    const sources = filesUnder(billingRoot).map((path) => codeWithoutComments(readFileSync(path, "utf8")));
    for (const source of sources) {
      expect(source).not.toContain("resolveMpAccessToken");
      expect(source).not.toContain("mercadopago-oauth");
    }
    const registry = readFileSync(join(billingRoot, "providers/index.ts"), "utf8");
    expect(registry).not.toContain("pix-platform");
    const skeleton = readFileSync(join(billingRoot, "providers/pix-platform.ts"), "utf8");
    expect(skeleton).toContain("MERCADOPAGO_ACCESS_TOKEN");
  });
});

describe("contrato e script", () => {
  it("documenta o texto de referência e as envs sem número real de exemplo fora do fictício", () => {
    const contracts = readFileSync(join(import.meta.dirname, "../../docs/CONTRATOS.md"), "utf8");
    expect(contracts).toContain("Recebemos seu pedido. Ativamos em até {activationHours} h.");
    const example = readFileSync(join(import.meta.dirname, "../../.env.example"), "utf8");
    expect(example).toContain(`SUPPORT_WHATSAPP_NUMBER=${fictionalNumber}`);
    expect(example).toContain("SUBSCRIPTION_MANUAL_ACTIVATION_HOURS=2");
  });

  it("exige operador e banco, e o mês padrão é 1", async () => {
    expect(parseActivateArgs(["--business", "salao", "--by", "ops"])).toEqual({ business: "salao", months: 1, by: "ops", dryRun: false });
    expect(parseActivateArgs(["--business=salao", "--by=ops", "--months=3", "--dry-run"])).toMatchObject({ months: 3, dryRun: true });
    expect(() => parseActivateArgs(["--business", "salao"])).toThrow(/--by/);
    expect(() => parseActivateArgs(["--business", "salao", "--by", "ops", "--months", "0"])).toThrow(/--months/);
    await expect(runActivateCli(["--business", "salao", "--by", "ops"], {})).rejects.toThrow(/DATABASE_URL/);
    await expect(runListRequestsCli(["--x"], { DATABASE_URL: "postgresql://agenda@localhost:5432/agenda" })).rejects.toThrow(/não recebe argumentos/);
  });

  it("decide 303 ou JSON pelo Accept e mantém erro fora desta função", async () => {
    const result = {
      provider: "manual" as const,
      request: { id: "6e4b4a1b-d218-4e6a-92c9-94de45059c4f", requestedAt: "2026-10-08T23:10:00.000Z" },
      whatsappUrl: manualWhatsappUrl(fictionalNumber, "http://localhost:3000/salao-da-ana"),
      activationHours: 5,
    };
    const form = new Request("http://localhost:3000/api/businesses/x/subscription/checkout", { method: "POST", headers: { accept: "text/html" } });
    const redirected = subscriptionCheckoutResponse(form, result);
    expect(requestWantsJson(form)).toBe(false);
    expect(redirected.status).toBe(303);
    expect(redirected.headers.get("location")).toBe(result.whatsappUrl);
    const jsonRequest = new Request("http://localhost:3000/api/businesses/x/subscription/checkout", { method: "POST", headers: { accept: "application/json" } });
    expect(requestWantsJson(jsonRequest)).toBe(true);
    const body = subscriptionCheckoutResponse(jsonRequest, result);
    expect(body.status).toBe(200);
    expect(await body.json()).toEqual(result);
  });
});
