import React, { Suspense } from "react";
import type { Metadata } from "next";
import { PreviewBadge } from "@/components/preview/PreviewBadge";
import { isPreviewBadgeEnabled } from "@/components/preview/preview-badge-gate";

export const metadata: Metadata = {
  title: "Modo Preview · AgendaPix",
  description: "Ambiente de visualização de desenvolvimento sem dependências externas.",
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {children}
      {isPreviewBadgeEnabled() ? (
        <Suspense fallback={null}>
          <PreviewBadge />
        </Suspense>
      ) : null}
    </div>
  );
}
