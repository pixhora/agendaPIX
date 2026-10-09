"use client";

import type { ReactNode } from "react";

export function StepHeader({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h1 className="font-display text-[28px] font-bold leading-[1.12] tracking-tight">{title}</h1>
      <p className="text-[15px] leading-normal text-muted">{description}</p>
    </div>
  );
}

export const stepBodyClass = "flex-1 space-y-5 px-5 pt-6 max-md:pb-[calc(var(--sticky-cta-height)+1rem)] md:pb-4";

export { StepActions } from "./chrome";
