import type { NextConfig } from "next";
import { STATIC_ASSET_HEADER_SOURCES, staticAssetSecurityHeaders } from "./lib/security/headers";

const staticHeaders = staticAssetSecurityHeaders();

const nextConfig: NextConfig = {
  // Standalone serve a imagem Docker; na Vercel (VERCEL=1 no build) o builder da plataforma empacota as funções.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  async headers() {
    return STATIC_ASSET_HEADER_SOURCES.map((source) => ({ source, headers: staticHeaders }));
  },
};

export default nextConfig;
