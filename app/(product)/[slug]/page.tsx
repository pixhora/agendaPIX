import { cache } from "react";
import { connection } from "next/server";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { toPublicBusinessData } from "@/components/booking/public-business";
import { legalPagesPublished } from "@/lib/marketing/flags";
import { supportWhatsappUrl } from "@/lib/support-contact";
import { SlugMoved, bookingRedirectPath } from "@/lib/business-profile/public-slug";
import { listPublicServices } from "@/lib/bookings/service";
import { HttpError } from "@/lib/http";
import { siteName } from "@/lib/site";

const loadPublicBusiness = cache(async (slug: string) => {
  await connection();
  try {
    return await listPublicServices(slug);
  } catch (error) {
    if (error instanceof SlugMoved) throw error;
    if (error instanceof HttpError && error.status === 404) return null;
    if (error instanceof z.ZodError) return null;
    throw error;
  }
});

function redirectMovedSlug(error: unknown, search: Record<string, string | string[] | undefined>) {
  if (error instanceof SlugMoved) permanentRedirect(bookingRedirectPath(error.slug, search));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let business: Awaited<ReturnType<typeof loadPublicBusiness>> = null;
  try {
    business = await loadPublicBusiness(slug);
  } catch (error) {
    if (!(error instanceof SlugMoved)) throw error;
  }
  if (!business) return { title: { absolute: "Página não encontrada · AgendaPix" }, robots: { index: false, follow: false } };
  const primary = business.services[0]?.name;
  const title = `${business.name} · Agende online`;
  const description = primary
    ? `Agende ${primary} com ${business.name}. Sinal pelo Pix, confirmação na hora.`
    : `Agende com ${business.name}. Sinal pelo Pix, confirmação na hora.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName,
      title,
      description,
      url: `/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const search = searchParams ? await searchParams : undefined;
  const bookingId = typeof search?.bookingId === "string" ? search.bookingId : undefined;
  let business: Awaited<ReturnType<typeof loadPublicBusiness>> = null;
  try {
    business = await loadPublicBusiness(slug);
  } catch (error) {
    redirectMovedSlug(error, search ?? {});
    throw error;
  }
  if (!business) notFound();
  return (
    <BookingFlow
      slug={slug}
      initialBookingId={bookingId}
      initialBusiness={toPublicBusinessData(business)}
      legalPagesPublished={legalPagesPublished()}
      supportWhatsappHref={supportWhatsappUrl()}
    />
  );
}
