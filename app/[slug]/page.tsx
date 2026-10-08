import { cache } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { listPublicServices } from "@/lib/bookings/service";
import { HttpError } from "@/lib/http";

const loadPublicBusiness = cache(async (slug: string) => {
  await connection();
  try {
    return await listPublicServices(slug);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    if (error instanceof z.ZodError) return null;
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await loadPublicBusiness(slug);
  if (!business) return { title: { absolute: "Página não encontrada · AgendaPix" }, robots: { index: false, follow: false } };
  const primary = business.services[0]?.name;
  return {
    title: { absolute: `${business.name} · Agende online` },
    description: primary
      ? `Agende ${primary} com ${business.name}. Sinal pelo Pix, confirmação na hora.`
      : `Agende com ${business.name}. Sinal pelo Pix, confirmação na hora.`,
    alternates: { canonical: `/${slug}` },
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
  const business = await loadPublicBusiness(slug);
  if (!business) notFound();
  const search = searchParams ? await searchParams : undefined;
  return <BookingFlow slug={slug} initialBookingId={search?.bookingId} />;
}
