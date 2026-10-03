import { BookingFlow } from "@/components/booking/BookingFlow";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Agendamento Online · ${slug}`,
    description: `Agende seu horário com praticidade e garantia por Pix.`,
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BookingFlow slug={slug} />;
}
