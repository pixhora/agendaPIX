import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { isDevExampleOpen } from "../../components/preview/preview-badge-gate";
import { assertProductionSafeEnv, assertVercelProductionBuild, resetBookingAccessSecretPreviousWarning, smtpFromUsesExampleDomain } from "../../lib/env";
import { assertMpOAuthPkce } from "../../lib/mercadopago-oauth/config";
import { magicLinkCapturePath } from "../../lib/email";
import { mpFixturesAllowed, readMpFixture } from "../../lib/mercadopago/dev-fixtures";

const capturePath = "/tmp/secret-magic-link-capture.txt";
const from = "AgendaPix <ci-secreta@example.com>";
const bookingAccess = "booking-access-secret-32-chars-dddd";
const authSecret = "better-auth-secret-32-chars-ok-bbbb";
const dedicatedBookingSecret = {
  BOOKING_ACCESS_SECRET: bookingAccess,
  BETTER_AUTH_SECRET: authSecret,
};

describe("boot de produção", () => {
  it("recusa captura, fixture e remetente example.com sem repetir o valor", () => {
    expect(smtpFromUsesExampleDomain(from)).toBe(true);
    expect(smtpFromUsesExampleDomain("AgendaPix <ci@mail.example.com>")).toBe(true);
    expect(smtpFromUsesExampleDomain("AgendaPix <ci@agendapix.dev.br>")).toBe(false);
    const env = {
      NODE_ENV: "production",
      MAGIC_LINK_CAPTURE_FILE: capturePath,
      MP_CAPTURE: "1",
      SMTP_FROM: from,
    };
    expect(() => assertProductionSafeEnv(env)).toThrow(/MAGIC_LINK_CAPTURE_FILE não pode estar definido em produção/);
    expect(() => assertProductionSafeEnv(env)).toThrow(/MP_CAPTURE não pode estar definido em produção/);
    expect(() => assertProductionSafeEnv(env)).toThrow(/SMTP_FROM não pode usar o domínio example.com em produção/);
    try {
      assertProductionSafeEnv(env);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(capturePath);
      expect(message).not.toContain("ci-secreta");
      expect(message).not.toContain("mail.example.com");
    }
  });

  it("libera desenvolvimento, build e variável vazia", () => {
    expect(() => assertProductionSafeEnv({
      NODE_ENV: "development",
      MAGIC_LINK_CAPTURE_FILE: capturePath,
      MP_CAPTURE: "1",
      SMTP_FROM: from,
    })).not.toThrow();
    expect(() => assertProductionSafeEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      MAGIC_LINK_CAPTURE_FILE: capturePath,
      MP_CAPTURE: "1",
      SMTP_FROM: from,
    })).not.toThrow();
    expect(() => assertProductionSafeEnv({
      NODE_ENV: "production",
      MAGIC_LINK_CAPTURE_FILE: "  ",
      MP_CAPTURE: "",
      SMTP_FROM: "AgendaPix <ci@agendapix.dev.br>",
      ...dedicatedBookingSecret,
    })).not.toThrow();
  });

  it("exige PKCE ligado quando o Mercado Pago está em produção e não repete o valor", () => {
    const secretValue = "segredo-nao-pode-vazar";
    const env = {
      NODE_ENV: "production",
      MERCADOPAGO_ENV: "production",
      MP_OAUTH_PKCE: secretValue,
      SMTP_FROM: "AgendaPix <ci@agendapix.dev.br>",
    };
    expect(() => assertProductionSafeEnv(env)).toThrow("MP_OAUTH_PKCE deve ser on quando MERCADOPAGO_ENV=production.");
    expect(() => assertProductionSafeEnv({ ...env, MP_OAUTH_PKCE: "off" })).toThrow(/MP_OAUTH_PKCE deve ser on/);
    expect(() => assertProductionSafeEnv({ ...env, MP_OAUTH_PKCE: undefined })).toThrow(/MP_OAUTH_PKCE deve ser on/);
    try {
      assertProductionSafeEnv(env);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(secretValue);
      expect(message).not.toContain("ci@agendapix");
    }
    expect(assertMpOAuthPkce({ MP_OAUTH_PKCE: " on " })).toBe(true);
    expect(() => assertProductionSafeEnv({ ...env, MP_OAUTH_PKCE: " on ", ...dedicatedBookingSecret })).not.toThrow();
    expect(assertMpOAuthPkce({ MP_OAUTH_PKCE: " off " })).toBe(false);
    expect(() => assertProductionSafeEnv({
      NODE_ENV: "production",
      MERCADOPAGO_ENV: "sandbox",
      MP_OAUTH_PKCE: "off",
      SMTP_FROM: "AgendaPix <ci@agendapix.dev.br>",
      ...dedicatedBookingSecret,
    })).not.toThrow();
    expect(() => assertProductionSafeEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      MERCADOPAGO_ENV: "production",
      MP_OAUTH_PKCE: "off",
      SMTP_FROM: "AgendaPix <ci@agendapix.dev.br>",
    })).not.toThrow();
  });

  it("rejeita bookingConfig inválido só no boot de produção", () => {
    expect(() => assertProductionSafeEnv({ BOOKING_HOLD_MINUTES: "27" })).not.toThrow();
    expect(() => assertProductionSafeEnv({ BOOKING_TRUST_PROXY: "yes" })).not.toThrow();
    const production = { NODE_ENV: "production", SMTP_FROM: "AgendaPix <ci@agendapix.dev.br>" };
    expect(() => assertProductionSafeEnv({ ...production, BOOKING_HOLD_MINUTES: "27" })).toThrow(/BOOKING_HOLD_MINUTES inválido/);
    expect(() => assertProductionSafeEnv({ ...production, BOOKING_TRUST_PROXY: "yes" })).toThrow(/BOOKING_TRUST_PROXY inválido/);
    try {
      assertProductionSafeEnv({ ...production, BOOKING_TRUST_PROXY: "yes" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("yes");
    }
    expect(() => assertProductionSafeEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      BOOKING_HOLD_MINUTES: "27",
    })).not.toThrow();
    try {
      assertProductionSafeEnv({ ...production, BOOKING_HOLD_MINUTES: "27" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("27");
      expect(message).not.toContain("ci@agendapix");
    }
  });
});

describe("build de produção na Vercel", () => {
  it("recusa PKCE ausente ou bookingConfig inválido e deixa preview e dev passarem", () => {
    expect(() => assertVercelProductionBuild({ VERCEL_ENV: "production" })).toThrow("MP_OAUTH_PKCE deve ser on quando VERCEL_ENV=production.");
    expect(() => assertVercelProductionBuild({ VERCEL_ENV: "production", MP_OAUTH_PKCE: "off" })).toThrow(/MP_OAUTH_PKCE deve ser on/);
    expect(() => assertVercelProductionBuild({ VERCEL_ENV: "production", MP_OAUTH_PKCE: "talvez" })).toThrow(/MP_OAUTH_PKCE deve ser on/);
    const secretValue = "segredo-nao-pode-vazar";
    try {
      assertVercelProductionBuild({ VERCEL_ENV: "production", MP_OAUTH_PKCE: secretValue });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(secretValue);
    }
    expect(() => assertVercelProductionBuild({
      VERCEL_ENV: "production",
      MP_OAUTH_PKCE: " on ",
      ...dedicatedBookingSecret,
    })).not.toThrow();

    const hold = "27";
    expect(() => assertVercelProductionBuild({
      VERCEL_ENV: "production",
      MP_OAUTH_PKCE: "on",
      BOOKING_HOLD_MINUTES: hold,
    })).toThrow(/BOOKING_HOLD_MINUTES/);
    try {
      assertVercelProductionBuild({ VERCEL_ENV: "production", MP_OAUTH_PKCE: "on", BOOKING_HOLD_MINUTES: hold });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("BOOKING_HOLD_MINUTES");
      expect(message).not.toContain(hold);
    }
    expect(() => assertVercelProductionBuild({
      VERCEL_ENV: "production",
      MP_OAUTH_PKCE: "on",
      BOOKING_TRUST_PROXY: "yes",
    })).toThrow(/BOOKING_TRUST_PROXY/);

    expect(() => assertVercelProductionBuild({
      VERCEL_ENV: "preview",
      MP_OAUTH_PKCE: "off",
      BOOKING_HOLD_MINUTES: hold,
      ...dedicatedBookingSecret,
    })).not.toThrow();
    expect(() => assertVercelProductionBuild({
      NODE_ENV: "development",
      BOOKING_HOLD_MINUTES: hold,
    })).not.toThrow();
    expect(() => assertVercelProductionBuild({
      VERCEL_ENV: "development",
      MP_OAUTH_PKCE: "off",
      BOOKING_TRUST_PROXY: "yes",
    })).not.toThrow();
  });

  it("o next.config chama a checagem que derruba o build", () => {
    const source = readFileSync("next.config.ts", "utf8");
    expect(source).toContain("assertVercelProductionBuild()");
  });
});

describe("BOOKING_ACCESS_SECRET em produção", () => {
  const boot = {
    NODE_ENV: "production",
    SMTP_FROM: "AgendaPix <ci@agendapix.dev.br>",
    ...dedicatedBookingSecret,
  };
  const build = {
    VERCEL_ENV: "production",
    MP_OAUTH_PKCE: "on",
    ...dedicatedBookingSecret,
  };

  it("recusa vazio, curto e igual a BETTER_AUTH_SECRET sem repetir o valor", () => {
    const leaked = "segredo-que-nao-pode-vazar-32charsxx";
    const short = "curto-demais";
    for (const env of [
      { ...boot, BOOKING_ACCESS_SECRET: "" },
      { ...boot, BOOKING_ACCESS_SECRET: undefined },
      { ...boot, BOOKING_ACCESS_SECRET: "   " },
    ]) {
      expect(() => assertProductionSafeEnv(env)).toThrow("BOOKING_ACCESS_SECRET é obrigatório em produção e no preview.");
    }
    expect(() => assertProductionSafeEnv({ ...boot, BOOKING_ACCESS_SECRET: short })).toThrow("BOOKING_ACCESS_SECRET precisa ter pelo menos 32 caracteres.");
    expect(() => assertProductionSafeEnv({
      ...boot,
      BOOKING_ACCESS_SECRET: leaked,
      BETTER_AUTH_SECRET: leaked,
    })).toThrow("BOOKING_ACCESS_SECRET não pode ser igual a BETTER_AUTH_SECRET.");
    try {
      assertProductionSafeEnv({ ...boot, BOOKING_ACCESS_SECRET: short });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("BOOKING_ACCESS_SECRET");
      expect(message).not.toContain(short);
    }
    try {
      assertProductionSafeEnv({ ...boot, BOOKING_ACCESS_SECRET: leaked, BETTER_AUTH_SECRET: leaked });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(leaked);
    }

    expect(() => assertVercelProductionBuild({ ...build, BOOKING_ACCESS_SECRET: "" })).toThrow("BOOKING_ACCESS_SECRET é obrigatório em produção e no preview.");
    expect(() => assertVercelProductionBuild({ ...build, BOOKING_ACCESS_SECRET: short })).toThrow("BOOKING_ACCESS_SECRET precisa ter pelo menos 32 caracteres.");
    expect(() => assertVercelProductionBuild({
      ...build,
      BOOKING_ACCESS_SECRET: leaked,
      BETTER_AUTH_SECRET: leaked,
    })).toThrow("BOOKING_ACCESS_SECRET não pode ser igual a BETTER_AUTH_SECRET.");
    try {
      assertVercelProductionBuild({ ...build, BOOKING_ACCESS_SECRET: leaked, BETTER_AUTH_SECRET: leaked });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(leaked);
    }
  });

  it("aceita segredo válido e não cobra a regra fora da Vercel de produção e preview", () => {
    expect(() => assertProductionSafeEnv(boot)).not.toThrow();
    expect(() => assertVercelProductionBuild(build)).not.toThrow();
    expect(() => assertProductionSafeEnv({ BOOKING_ACCESS_SECRET: "", NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionSafeEnv({ BOOKING_ACCESS_SECRET: "curto", NODE_ENV: "test" })).not.toThrow();
    expect(() => assertProductionSafeEnv({
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      BOOKING_ACCESS_SECRET: "",
    })).not.toThrow();
    expect(() => assertVercelProductionBuild({ VERCEL_ENV: "preview", BOOKING_ACCESS_SECRET: "" })).toThrow("BOOKING_ACCESS_SECRET é obrigatório em produção e no preview.");
    expect(() => assertVercelProductionBuild({ VERCEL_ENV: "development", BOOKING_ACCESS_SECRET: "curto" })).not.toThrow();
  });

  it("recusa o prefixo de exemplo e cobra as mesmas regras no preview", () => {
    const placeholder = "replace-this-with-a-real-booking-secret-32";
    const message = "BOOKING_ACCESS_SECRET ainda é o valor de exemplo. Troque o segredo.";
    expect(() => assertProductionSafeEnv({ ...boot, BOOKING_ACCESS_SECRET: placeholder })).toThrow(message);
    expect(() => assertVercelProductionBuild({ ...build, BOOKING_ACCESS_SECRET: placeholder })).toThrow(message);
    const preview = { VERCEL_ENV: "preview", BETTER_AUTH_SECRET: authSecret };
    expect(() => assertVercelProductionBuild({ ...preview, BOOKING_ACCESS_SECRET: placeholder })).toThrow(message);
    try {
      assertVercelProductionBuild({ ...preview, BOOKING_ACCESS_SECRET: placeholder });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      expect(text).not.toContain(placeholder);
      expect(text).not.toContain("with-a-real-booking-secret");
    }
    expect(() => assertVercelProductionBuild(preview)).toThrow("BOOKING_ACCESS_SECRET é obrigatório em produção e no preview.");
    expect(() => assertVercelProductionBuild({ ...preview, BOOKING_ACCESS_SECRET: "curto" })).toThrow("BOOKING_ACCESS_SECRET precisa ter pelo menos 32 caracteres.");
    expect(() => assertVercelProductionBuild({ ...preview, BOOKING_ACCESS_SECRET: authSecret })).toThrow("BOOKING_ACCESS_SECRET não pode ser igual a BETTER_AUTH_SECRET.");
    expect(() => assertVercelProductionBuild({
      ...preview,
      BOOKING_ACCESS_SECRET: bookingAccess,
      MP_OAUTH_PKCE: "off",
      BOOKING_HOLD_MINUTES: "27",
    })).not.toThrow();
  });

  it("deixa PREVIOUS igual a BETTER_AUTH_SECRET e avisa uma vez no boot, sem o valor", () => {
    resetBookingAccessSecretPreviousWarning();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertProductionSafeEnv({ ...boot, BOOKING_ACCESS_SECRET_PREVIOUS: authSecret })).not.toThrow();
    expect(() => assertVercelProductionBuild({ ...build, BOOKING_ACCESS_SECRET_PREVIOUS: authSecret })).not.toThrow();
    expect(() => assertProductionSafeEnv({ ...boot, BOOKING_ACCESS_SECRET_PREVIOUS: "   " })).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    const text = warn.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(text).toContain("BOOKING_ACCESS_SECRET_PREVIOUS");
    expect(text).toContain("Pix de link de horário já começado antes da rotação");
    expect(text).not.toContain("reservas ativas");
    expect(text).not.toContain(authSecret);
    expect(text).not.toContain(bookingAccess);
    warn.mockRestore();
  });

  it("avisa sem o valor quando PREVIOUS repete o segredo atual e ignora um PREVIOUS curto", () => {
    resetBookingAccessSecretPreviousWarning();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const short = "curto-demais";
    expect(() => assertProductionSafeEnv({ ...boot, BOOKING_ACCESS_SECRET_PREVIOUS: bookingAccess })).not.toThrow();
    const equalText = warn.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(equalText).toContain("BOOKING_ACCESS_SECRET_PREVIOUS é igual a BOOKING_ACCESS_SECRET.");
    expect(equalText).toContain("Pix de link de horário já começado antes da rotação");
    expect(equalText).not.toContain(bookingAccess);
    expect(equalText).not.toContain(authSecret);
    warn.mockRestore();

    resetBookingAccessSecretPreviousWarning();
    const shortWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertProductionSafeEnv({ ...boot, BOOKING_ACCESS_SECRET_PREVIOUS: short })).not.toThrow();
    const shortText = shortWarn.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(shortText).toContain("BOOKING_ACCESS_SECRET_PREVIOUS precisa ter pelo menos 32 caracteres.");
    expect(shortText).not.toContain(short);
    expect(shortText).not.toContain("Pix de link de horário");
    shortWarn.mockRestore();
  });
});

describe("captura e fixture fora do boot", () => {
  it("não grava magic link em produção e não abre fixture com MP_CAPTURE", () => {
    expect(magicLinkCapturePath({ NODE_ENV: "production", MAGIC_LINK_CAPTURE_FILE: capturePath })).toBeUndefined();
    expect(magicLinkCapturePath({ NODE_ENV: "test", MAGIC_LINK_CAPTURE_FILE: capturePath })).toBe(capturePath);
    expect(mpFixturesAllowed("production")).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MP_CAPTURE", "1");
    expect(mpFixturesAllowed()).toBe(false);
    expect(readMpFixture("connected")).toBeNull();
    vi.unstubAllEnvs();
    const layout = readFileSync("app/(product)/preview/layout.tsx", "utf8");
    const painel = readFileSync("app/preview/painel/page.tsx", "utf8");
    expect(layout).toContain("isDevExampleOpen()");
    expect(layout).toContain("notFound()");
    expect(painel).toContain("isDevExampleOpen()");
    expect(isDevExampleOpen("production")).toBe(false);
    expect(isDevExampleOpen("development")).toBe(true);
  });
});
