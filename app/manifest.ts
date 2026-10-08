import type { MetadataRoute } from "next";
import { brandColors } from "@/lib/brand/colors";
import { brandIconFiles } from "@/lib/brand/mark";
import { siteDescription, siteName } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: siteName,
    description: siteDescription,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: brandColors.paper,
    theme_color: brandColors.ink,
    lang: "pt-BR",
    icons: [
      { src: brandIconFiles.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: brandIconFiles.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: brandIconFiles.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
