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
  searchParams?: Promise<{ etapa?: string; prazo?: string }>;
}) {
  const search = searchParams ? await searchParams : undefined;
  return <PreviewBookingFlow scene={parsePreviewScene(search?.etapa, search?.prazo)} />;
}
