import Link from "next/link";
import { DemoSection } from "@/components/landing/DemoSection";
import { LandingBenefits } from "@/components/landing/LandingBenefits";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingSteps } from "@/components/landing/LandingSteps";
import { MoneyFlow } from "@/components/landing/MoneyFlow";
import { Roadmap } from "@/components/landing/Roadmap";
import { getPublicBookingFacts } from "@/lib/marketing/facts";
import { publicSiteHost } from "@/lib/site";

export default async function PreviewLandingPage() {
  const facts = await getPublicBookingFacts();
  const publicHost = publicSiteHost();

  return (
    <div className="flex min-h-dvh w-full max-w-full flex-col overflow-x-clip bg-paper text-ink">
      <header className="sticky top-0 z-40 w-full border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/preview" className="font-display text-lg font-bold tracking-tight">
            AgendaPix <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-paper">Preview</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/preview/dashboard" className="hidden min-h-11 items-center rounded-full border border-line px-3 text-xs font-semibold sm:inline-flex">
              Ver painel
            </Link>
            <Link href="/preview/booking" className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-xs font-semibold text-paper">
              Testar agendamento
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <LandingHero publicHost={publicHost} />
        <LandingSteps publicHost={publicHost} />
        <DemoSection facts={facts} />
        <MoneyFlow facts={facts} />
        <LandingBenefits />
        <Roadmap />
        <LandingPricing />
        <LandingFaq facts={facts} />
        <LandingFinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
