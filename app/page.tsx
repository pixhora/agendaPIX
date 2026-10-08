import type { Metadata } from "next";
import { DemoSection } from "@/components/landing/DemoSection";
import { LandingBenefits } from "@/components/landing/LandingBenefits";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingSteps } from "@/components/landing/LandingSteps";
import { MoneyFlow } from "@/components/landing/MoneyFlow";
import { Roadmap } from "@/components/landing/Roadmap";
import { StickyCta } from "@/components/landing/StickyCta";
import { landingBootScript } from "@/components/landing/landing-boot-script";
import { getPublicBookingFacts } from "@/lib/marketing/facts";
import { publicSiteHost, siteOpenGraph } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...siteOpenGraph, url: "/" },
};

export default async function Home() {
  const facts = await getPublicBookingFacts();
  const publicHost = publicSiteHost();

  return (
    <div className="relative flex min-h-dvh w-full max-w-full flex-col overflow-x-clip bg-paper font-display">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-ink focus:px-4 focus:text-sm focus:font-semibold focus:text-paper"
      >
        Pular para o conteúdo
      </a>
      <LandingHeader />
      <main id="content" tabIndex={-1} className="flex-1 pb-[var(--sticky-cta-pad)] outline-none">
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
      <StickyCta />
      <script type="module" dangerouslySetInnerHTML={{ __html: landingBootScript }} />
    </div>
  );
}
