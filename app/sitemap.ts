import type { MetadataRoute } from "next";
import { legalPagesPublished } from "@/lib/marketing/flags";
import { siteOrigin } from "@/lib/site";

/** Termos e privacidade só entram depois da aprovação jurídica. Negócios ficam de fora. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const pages: MetadataRoute.Sitemap = [
    {
      url: new URL("/", origin).href,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
  if (legalPagesPublished()) {
    pages.push(
      { url: new URL("/termos", origin).href, changeFrequency: "monthly", priority: 0.3 },
      { url: new URL("/privacidade", origin).href, changeFrequency: "monthly", priority: 0.3 },
    );
  }
  return pages;
}
