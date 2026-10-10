import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/toaster";
import { siteDescription, siteName, siteOpenGraph, siteOrigin, siteTitle } from "@/lib/site";
import { MercadoPagoCallback } from "@/components/payments/mp-callback";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";
import Script from "next/script";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-family",
  display: "swap",
});

// A landing pinta com Plus Jakarta. Inter não entra no preload.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans-family",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: { default: siteTitle, template: `%s · ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  openGraph: siteOpenGraph,
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f10" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading headers opts every page into dynamic rendering so the nonce matches this request.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" className={`${plusJakartaSans.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura (sem flash). Nonce vem do proxy. */}
        <Script id="theme-init" nonce={nonce} strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        {children}
        <Suspense fallback={null}>
          <MercadoPagoCallback />
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
