import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone serve a imagem Docker; na Vercel (VERCEL=1 no build) o builder da plataforma empacota as funções.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  experimental: {
    // Tira o CSS do caminho crítico (pedido extra antes da primeira pintura).
    inlineCss: true,
  },
};

export default nextConfig;
