import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { isDevExampleOpen } from "../../components/preview/preview-badge-gate";
import { assertProductionSafeEnv, assertVercelProductionBuild, smtpFromUsesExampleDomain } from "../../lib/env";
import { assertMpOAuthPkce } from "../../lib/mercadopago-oauth/config";
import { magicLinkCapturePath } from "../../lib/email";
import { mpFixturesAllowed, readMpFixture } from "../../lib/mercadopago/dev-fixtures";

const capturePath = "/tmp/secret-magic-link-capture.txt";
const from = "AgendaPix <ci-secreta@example.com>";

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
    expect(() => assertProductionSafeEnv({ ...env, MP_OAUTH_PKCE: " on " })).not.toThrow();
    expect(assertMpOAuthPkce({ MP_OAUTH_PKCE: " off " })).toBe(false);
    expect(() => assertProductionSafeEnv({
      NODE_ENV: "production",
      MERCADOPAGO_ENV: "sandbox",
      MP_OAUTH_PKCE: "off",
      SMTP_FROM: "AgendaPix <ci@agendapix.dev.br>",
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
    expect(() => assertVercelProductionBuild({ VERCEL_ENV: "production", MP_OAUTH_PKCE: " on " })).not.toThrow();

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
