import React from "react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPainSolution } from "@/components/landing/LandingPainSolution";
import { LandingInteractiveDemo } from "@/components/landing/LandingInteractiveDemo";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground w-full max-w-full overflow-x-hidden">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingPainSolution />
        <LandingInteractiveDemo />
        <LandingPricing />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
