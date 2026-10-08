import type { MpOwnerStatus } from "./contract";
import { MP_CONNECT_CONSENT_VERSION } from "./consent";

/**
 * DEV ONLY. Payload de status enquanto o GET real não está neste branch.
 * O módulo inteiro sai quando o backend de status entrar: nenhum caller de produção
 * deve importá-lo sem passar por `readMpFixture`, que devolve null em production.
 */
export const MP_FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-0000000000a1";

const base = {
  connectedAt: "2026-10-08T20:02:00.000Z",
  expiresAt: "2027-04-06T20:02:00.000Z",
  liveMode: true,
  canReceiveDeposits: true,
  hadLegacyPixKey: false,
  consentVersion: MP_CONNECT_CONSENT_VERSION,
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
  },
  needs_reconnect: { ...base, status: "needs_reconnect", canReceiveDeposits: false },
  test_mode: { ...base, status: "connected", liveMode: false },
  stale_consent: { ...base, status: "connected", consentVersion: "2026-09-01.v1" },
} as const satisfies Record<string, MpOwnerStatus>;

export type MpFixtureName = keyof typeof MP_STATUS_FIXTURES;

export function mpFixturesAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
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
  };
}
