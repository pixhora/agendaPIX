import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { siteDescription, siteName, siteOpenGraph, siteOrigin, siteTitle } from "@/lib/site";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-family",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans-family",
  display: "swap",
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${plusJakartaSans.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura (sem flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
