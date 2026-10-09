"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseMpOwnerStatus, mpConnectionUrl, type MpOwnerStatus } from "@/lib/mercadopago/contract";
import { readMpFixture } from "@/lib/mercadopago/dev-fixtures";
import { MpBannerList } from "./mp-banner";

export function DashboardMpBanner({
  businesses,
}: {
  businesses: { id: string; hasDepositService: boolean }[];
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("businessId");
  const business = (requested ? businesses.find((item) => item.id === requested) : undefined) ?? businesses[0];
  const businessId = business?.id ?? null;
  const fixtureName = searchParams.get("mpFixture");
  const [status, setStatus] = useState<MpOwnerStatus | null>(() => readMpFixture(fixtureName));

  useEffect(() => {
    const fixture = readMpFixture(fixtureName);
    if (fixture) {
      const timer = window.setTimeout(() => setStatus(fixture), 0);
      return () => window.clearTimeout(timer);
    }
    if (!businessId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(mpConnectionUrl(businessId), { cache: "no-store", signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          setStatus(parseMpOwnerStatus(payload));
        })
        .catch(() => {
          setStatus(null);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [businessId, fixtureName]);

  if (!business || !status) return null;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-10">
      <MpBannerList businessId={business.id} status={status} hasDepositService={business.hasDepositService} />
    </div>
  );
}
