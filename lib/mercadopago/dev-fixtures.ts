import type { MpOwnerStatus } from "./contract";
import { MP_CONNECT_CONSENT_VERSION } from "./consent";
import { MP_MOCK_FRIDAY_16 } from "./connect-copy";

/**
 * DEV ONLY. Payload de status enquanto o GET real não está neste branch.
 * O módulo inteiro sai quando o backend de status entrar: nenhum caller de produção
 * deve importá-lo sem passar por `readMpFixture`, que devolve null em production.
 */
export const MP_FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-0000000000a1";

const base = {
  connectedAt: MP_MOCK_FRIDAY_16,
  expiresAt: "2027-04-06T20:02:00.000Z",
  liveMode: true,
  canReceiveDeposits: true,
  hadLegacyPixKey: false,
  consentVersion: MP_CONNECT_CONSENT_VERSION,
  accountName: "Ana S.",
  accountEmailMasked: "an••@gmail.com",
  accountIdLast4: "3636",
} satisfies Omit<MpOwnerStatus, "status">;

export const MP_STATUS_FIXTURES = {
  connected: { ...base, status: "connected" },
  legacy: { ...base, status: "connected", hadLegacyPixKey: true },
  not_connected: {
    status: "not_connected",
    connectedAt: null,
    expiresAt: null,
    liveMode: null,
    canReceiveDeposits: false,
    hadLegacyPixKey: false,
    consentVersion: null,
    accountName: null,
    accountEmailMasked: null,
    accountIdLast4: null,
  },
  /** Conectado sem nome nem e-mail: cai no número final da conta. */
  account_fallback: {
    ...base,
    status: "connected",
    accountName: null,
    accountEmailMasked: null,
    accountIdLast4: "3636",
  },
  /** Mesma versão aceita: reconectar sem a caixa. */
  needs_reconnect: { ...base, status: "needs_reconnect", canReceiveDeposits: false },
  test_mode: { ...base, status: "connected", liveMode: false },
  /** Versão diferente: a caixa volta no reconectar. */
  stale_consent: { ...base, status: "connected", consentVersion: "2026-09-01.v1" },
  /** Desconectado e sem aceite desta versão: a caixa volta. */
  needs_reconnect_stale: {
    ...base,
    status: "needs_reconnect",
    canReceiveDeposits: false,
    consentVersion: null,
  },
} as const satisfies Record<string, MpOwnerStatus>;

export type MpFixtureName = keyof typeof MP_STATUS_FIXTURES;

/** Em produção a rota fica fechada. O build de captura liga com MP_CAPTURE=1. */
export function mpFixturesAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.MP_CAPTURE === "1";
}

export function readMpFixture(name: string | null | undefined): MpOwnerStatus | null {
  if (!mpFixturesAllowed() || !name) return null;
  if (!Object.prototype.hasOwnProperty.call(MP_STATUS_FIXTURES, name)) return null;
  const fixture = MP_STATUS_FIXTURES[name as MpFixtureName];
  return {
    status: fixture.status,
    connectedAt: fixture.connectedAt ?? null,
    expiresAt: fixture.expiresAt ?? null,
    liveMode: fixture.liveMode ?? null,
    canReceiveDeposits: fixture.canReceiveDeposits === true,
    hadLegacyPixKey: fixture.hadLegacyPixKey === true,
    consentVersion: fixture.consentVersion ?? null,
    accountName: fixture.accountName ?? null,
    accountEmailMasked: fixture.accountEmailMasked ?? null,
    accountIdLast4: fixture.accountIdLast4 ?? null,
  };
}
