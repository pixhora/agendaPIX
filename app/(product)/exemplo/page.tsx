import type { Metadata } from "next";
import { PreviewBookingFlow } from "@/components/preview/PreviewBookingFlow";

export const metadata: Metadata = {
  title: { absolute: "Demonstração · AgendaPix" },
  description: "Demonstração com dados fictícios. Nenhum Pix real é gerado.",
  robots: { index: false, follow: false },
};

export default function ExemploPage() {
  return <PreviewBookingFlow mode="demo" />;
}
