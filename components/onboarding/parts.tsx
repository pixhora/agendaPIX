"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribeNoop = () => () => {};

/** Domínio exibido antes do link: o host real no navegador; no servidor, um texto neutro. */
export function usePublicHost() {
  return useSyncExternalStore(subscribeNoop, () => window.location.host, () => "seu-site");
}

export function StepHeader({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h1 className="font-display text-[28px] font-bold leading-[1.12] tracking-tight">{title}</h1>
      <p className="text-[15px] leading-normal text-muted">{description}</p>
    </div>
  );
}

export { StepActions } from "./chrome";
