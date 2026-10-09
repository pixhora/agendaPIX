import type { NextConfig } from "next";
import { staticAssetHeaderRules } from "./lib/security/headers";

const nextConfig: NextConfig = {
  // Standalone serve a imagem Docker; na Vercel (VERCEL=1 no build) o builder da plataforma empacota as funções.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    // Tira o CSS do caminho crítico (pedido extra antes da primeira pintura).
    inlineCss: true,
  },
  async headers() {
    return staticAssetHeaderRules(process.env.NODE_ENV === "development");
  },
};

export default nextConfig;
