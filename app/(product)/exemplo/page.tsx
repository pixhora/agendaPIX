import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewBookingFlow } from "@/components/preview/PreviewBookingFlow";
import { isPreviewRouteOpen } from "@/lib/preview/access";

export const metadata: Metadata = {
  title: { absolute: "Demonstração · AgendaPix" },
  description: "Demonstração com dados fictícios. Nenhum Pix real é gerado.",
  robots: { index: false, follow: false },
};

export default function ExemploPage() {
  if (!isPreviewRouteOpen()) notFound();
  return <PreviewBookingFlow mode="demo" />;
}
