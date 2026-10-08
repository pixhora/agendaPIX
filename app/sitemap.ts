import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

/** Só a home. Termos e privacidade entram depois da aprovação jurídica. Negócios ficam de fora. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", siteOrigin()).href,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
