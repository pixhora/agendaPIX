import type { Metadata } from "next";
import { Suspense } from "react";
import { MpRecebimento } from "@/components/payments/mp-recebimento";

export const metadata: Metadata = {
  title: "Recebimento · AgendaPix",
  robots: { index: false },
};

export default async function RecebimentoPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  // Só em desenvolvimento: o e2e abre esta query para ver o error boundary. Em produção o ramo some.
  if (process.env.NODE_ENV !== "production" && erro === "retorno") {
    throw new Error("onboarding_mp_return_probe");
  }
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
