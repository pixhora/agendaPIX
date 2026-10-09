import type { NextConfig } from "next";
import { staticAssetHeaderRules } from "./lib/security/headers";

const nextConfig: NextConfig = {
  // O e2e da publicação legal não pode reusar o .next do suite principal: lá a flag está desligada.
  ...(process.env.NEXT_DIST_DIR === ".next-legal" ? { distDir: ".next-legal" } : {}),
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
