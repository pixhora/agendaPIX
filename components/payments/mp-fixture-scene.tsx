"use client";

import { useState } from "react";
import { BookingFlow } from "@/components/booking/BookingFlow";
import type { PublicBusinessData } from "@/components/booking/types";
import { MP_ACCOUNT_NOT_CONNECTED, presentMpCallback, type MpOwnerStatus } from "@/lib/mercadopago/contract";
import { MP_FIXTURE_BUSINESS_ID, MP_STATUS_FIXTURES, type MpFixtureName } from "@/lib/mercadopago/dev-fixtures";
import { MpBannerList } from "./mp-banner";
import { MpOnboardingStep } from "./mp-onboarding-step";
import { MpSettingsCard } from "./mp-settings-card";

const PUBLIC_UNAVAILABLE: PublicBusinessData = {
  name: "Studio Ana",
  timezone: "America/Sao_Paulo",
  phone: "5511999998888",
  services: [
    {
      id: "corte",
      name: "Corte",
      durationMinutes: 45,
      priceCents: 8000,
      depositCents: 2000,
      bookable: false,
      reason: MP_ACCOUNT_NOT_CONNECTED,
    },
    {
      id: "barba",
      name: "Barba",
      durationMinutes: 30,
      priceCents: 4500,
      depositCents: 1500,
      bookable: false,
      reason: MP_ACCOUNT_NOT_CONNECTED,
    },
  ],
};

function SettingsScene({
  fixture,
  disconnect = false,
}: {
  fixture: MpFixtureName;
  disconnect?: boolean;
}) {
  const initial = MP_STATUS_FIXTURES[fixture];
  const [status, setStatus] = useState<MpOwnerStatus>({ ...initial });
  return (
    <main className="min-h-dvh bg-paper">
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Ajustes</h1>
        <div className="mt-6">
          <MpSettingsCard
            businessId={MP_FIXTURE_BUSINESS_ID}
            status={status}
            timezone="America/Sao_Paulo"
            pendingPixCount={disconnect ? 2 : 0}
            onStatus={setStatus}
            initialDisconnectOpen={disconnect}
          />
        </div>
      </div>
    </main>
  );
}

export function MpFixtureScene({ scene }: { scene: string }) {
  if (scene === "onboarding-connected") {
    return (
      <MpOnboardingStep
        businessId={MP_FIXTURE_BUSINESS_ID}
        callback={presentMpCallback("connected", null)}
        connectedAt={MP_STATUS_FIXTURES.connected.connectedAt}
        onDismissAccount={() => undefined}
      />
    );
  }
  if (scene === "onboarding-error") {
    return (
      <MpOnboardingStep
        businessId={MP_FIXTURE_BUSINESS_ID}
        callback={presentMpCallback("error", "access_denied")}
      />
    );
  }
  if (scene === "settings-connected") return <SettingsScene fixture="connected" />;
  if (scene === "settings-legacy") return <SettingsScene fixture="legacy" />;
  if (scene === "settings-not-connected") return <SettingsScene fixture="not_connected" />;
  if (scene === "settings-needs-reconnect") return <SettingsScene fixture="needs_reconnect" />;
  if (scene === "settings-reconnect-ack") return <SettingsScene fixture="needs_reconnect_stale" />;
  if (scene === "settings-test") return <SettingsScene fixture="test_mode" />;
  if (scene === "disconnect") return <SettingsScene fixture="connected" disconnect />;
  if (scene === "banner") {
    return (
      <main className="min-h-dvh bg-paper">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Agenda de hoje</h1>
          <div className="mt-4">
            <MpBannerList
              businessId={MP_FIXTURE_BUSINESS_ID}
              status={{ ...MP_STATUS_FIXTURES.needs_reconnect }}
              hasDepositService
            />
          </div>
        </div>
      </main>
    );
  }
  if (scene === "public") {
    return <BookingFlow slug="studio-ana" previewBusiness={PUBLIC_UNAVAILABLE} />;
  }
  return <MpOnboardingStep businessId={MP_FIXTURE_BUSINESS_ID} />;
}
