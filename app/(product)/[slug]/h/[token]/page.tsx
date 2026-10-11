import type { Metadata } from "next";
import { connection } from "next/server";
import { SlotLinkCustomer } from "@/components/slot-link/slot-link-customer";
import { listPublicServices } from "@/lib/bookings/service";
import { siteName } from "@/lib/site";
import { slotLinkShareMeta } from "@/lib/slot-link/share-meta";

export const dynamic = "force-dynamic";

async function storeFor(slug: string) {
  try {
    const business = await listPublicServices(slug);
    return {
      timezone: business.timezone || "America/Sao_Paulo",
      businessName: business.name,
      contactWhatsapp: business.contactWhatsapp,
    };
  } catch {
    return { timezone: "America/Sao_Paulo", businessName: null, contactWhatsapp: null };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}): Promise<Metadata> {
  const { slug, token } = await params;
  const share = await slotLinkShareMeta(slug, token);
  return {
    title: { absolute: share.title },
    description: share.description,
    robots: { index: false, follow: false },
    openGraph: {
      title: share.title,
      description: share.description,
      images: share.image ? [{ url: share.image }] : undefined,
      type: "website",
      locale: "pt_BR",
      siteName,
    },
    twitter: {
      card: "summary_large_image",
      title: share.title,
      description: share.description,
      images: share.image ? [share.image] : undefined,
    },
  };
}

export default async function SlotLinkPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  await connection();
  const { slug, token } = await params;
  const store = await storeFor(slug);
  return (
    <SlotLinkCustomer
      slug={slug}
      token={token}
      timezone={store.timezone}
      businessName={store.businessName}
      contactWhatsapp={store.contactWhatsapp}
    />
  );
}
