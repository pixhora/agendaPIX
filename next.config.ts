import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone serve a imagem Docker; na Vercel (VERCEL=1 no build) o builder da plataforma empacota as funções.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
};

export default nextConfig;
