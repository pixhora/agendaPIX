import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalArticle } from "@/components/legal/LegalArticle";
import { BrandLink } from "@/components/ui/brand";
import { loadLegalDocument } from "@/lib/legal/load";
import { legalPagesPublished } from "@/lib/marketing/flags";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade do AgendaPix.",
};

export default function PrivacidadePage() {
  if (!legalPagesPublished()) notFound();
  const document = loadLegalDocument("privacidade");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <BrandLink />
      <LegalArticle markdown={document.markdown} toc={document.toc} />
    </main>
  );
}
