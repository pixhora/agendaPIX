import React, { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewBadge } from "@/components/preview/PreviewBadge";
import { isDevExampleOpen, isPreviewBadgeEnabled } from "@/components/preview/preview-badge-gate";
import { isPreviewRouteOpen } from "@/lib/preview/access";

export const metadata: Metadata = {
  title: "Modo Preview",
  description: "Ambiente de visualização de desenvolvimento sem dependências externas.",
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (!isDevExampleOpen() && !isPreviewRouteOpen()) notFound();
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
