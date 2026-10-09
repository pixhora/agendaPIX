import React from "react";
import type { Metadata } from "next";
import { PreviewBookingFlow } from "@/components/preview/PreviewBookingFlow";
import { parsePreviewScene } from "@/components/preview/scene";

export const metadata: Metadata = {
  title: "Booking Preview · Studio Bella",
  description: "Fluxo de agendamento do cliente com dados determinísticos.",
};

export default async function PreviewBookingPage({
  searchParams,
}: {
  searchParams?: Promise<{ etapa?: string; prazo?: string; captura?: string; variante?: string }>;
}) {
  const search = searchParams ? await searchParams : undefined;
  const variant = search?.variante === "credito" || search?.variante === "credit" ? "credit" : search?.variante === "padrao" || search?.variante === "retain" ? "retain" : undefined;
  return <PreviewBookingFlow scene={parsePreviewScene(search?.etapa, search?.prazo)} capture={search?.captura === "1"} variant={variant} />;
}
