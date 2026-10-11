import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PixChargeFixture } from "@/components/booking/pix-charge-fixture";
import { mpFixturesAllowed } from "@/lib/mercadopago/dev-fixtures";

export const metadata: Metadata = {
  title: "Prévia da falha do Pix",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PixChargeFixturesPage({ searchParams }: { searchParams: Promise<{ scene?: string }> }) {
  if (!mpFixturesAllowed()) notFound();
  const { scene = "failed" } = await searchParams;
  if (scene !== "failed" && scene !== "generating") notFound();
  return <PixChargeFixture scene={scene} />;
}
