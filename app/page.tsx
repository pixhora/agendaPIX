import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFacts } from "@/components/landing/LandingFacts";
import { LandingSteps } from "@/components/landing/LandingSteps";
import { LandingBenefits } from "@/components/landing/LandingBenefits";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { siteOpenGraph } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...siteOpenGraph, url: "/" },
};

export default function Home() {
  return (
    <div className="flex min-h-dvh w-full max-w-full flex-col overflow-x-clip bg-paper">
      <LandingHeader />
      <main id="content" className="flex-1">
        <LandingHero />
        <LandingFacts />
        <LandingSteps />
        <LandingBenefits />
        <LandingPricing />
        <LandingFaq />
        <LandingFinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
