import React from "react";
import type { Metadata } from "next";
import { PreviewBadge } from "@/components/preview/PreviewBadge";

export const metadata: Metadata = {
  title: "Modo Preview",
  description: "Ambiente de visualização de desenvolvimento sem dependências externas.",
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {children}
      <PreviewBadge />
    </div>
  );
}
