import React from "react";
import type { Metadata } from "next";
import { PreviewBookingFlow } from "@/components/preview/PreviewBookingFlow";

export const metadata: Metadata = {
  title: "Booking Preview · Studio Bella",
  description: "Fluxo de agendamento do cliente com dados determinísticos.",
};

export default function PreviewBookingPage() {
  return <PreviewBookingFlow />;
}
