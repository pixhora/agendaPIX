import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MpFixtureScene } from "@/components/payments/mp-fixture-scene";
import { mpFixturesAllowed } from "@/lib/mercadopago/dev-fixtures";

export const metadata: Metadata = {
  title: "Prévia Mercado Pago",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SCENES = [
  "onboarding",
  "onboarding-connected",
  "onboarding-error",
  "settings-connected",
  "settings-legacy",
  "settings-not-connected",
  "settings-needs-reconnect",
  "settings-reconnect-ack",
  "settings-test",
  "disconnect",
  "banner",
  "public",
] as const;

export default async function MpFixturesPage({ searchParams }: { searchParams: Promise<{ scene?: string }> }) {
  if (!mpFixturesAllowed()) notFound();
  const { scene = "onboarding" } = await searchParams;
  if (!SCENES.includes(scene as (typeof SCENES)[number])) notFound();
  return <MpFixtureScene scene={scene} />;
}
