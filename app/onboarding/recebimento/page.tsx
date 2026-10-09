import type { Metadata } from "next";
import { Suspense } from "react";
import { MpRecebimento } from "@/components/payments/mp-recebimento";

export const metadata: Metadata = {
  title: "Recebimento · AgendaPix",
  robots: { index: false },
};

export default function RecebimentoPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center p-6" role="status">
          <p className="text-sm text-muted">Carregando recebimento…</p>
        </main>
      }
    >
      <MpRecebimento legalPagesPublished={process.env.LEGAL_PAGES_PUBLISHED === "true"} />
    </Suspense>
  );
}
