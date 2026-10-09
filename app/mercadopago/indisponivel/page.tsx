import type { Metadata } from "next";
import { MpConnectUnavailable } from "@/components/payments/mp-connect-unavailable";
import { connectUnavailableBackHref, MP_CONNECT_UNAVAILABLE_TITLE } from "@/lib/mercadopago/connect-navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: MP_CONNECT_UNAVAILABLE_TITLE,
  robots: { index: false, follow: false },
};

export default async function MercadoPagoUnavailablePage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return <MpConnectUnavailable backHref={connectUnavailableBackHref(returnTo)} />;
}
