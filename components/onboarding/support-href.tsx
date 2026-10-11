"use client";

import { createContext, useContext, type ReactNode } from "react";

const OnboardingSupportHrefContext = createContext<string | null>(null);

/** O layout do servidor manda o link. O error boundary, que não recebe prop extra, lê daqui. */
export function OnboardingSupportProvider({
  supportWhatsappHref,
  children,
}: {
  supportWhatsappHref: string | null;
  children: ReactNode;
}) {
  return <OnboardingSupportHrefContext.Provider value={supportWhatsappHref}>{children}</OnboardingSupportHrefContext.Provider>;
}

export function useOnboardingSupportHref(): string | null {
  return useContext(OnboardingSupportHrefContext);
}
