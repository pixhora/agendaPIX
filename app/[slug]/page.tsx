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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ bookingId?: string }>;
}) {
  const { slug } = await params;
  const search = searchParams ? await searchParams : undefined;
  return <BookingFlow slug={slug} initialBookingId={search?.bookingId} />;
}
