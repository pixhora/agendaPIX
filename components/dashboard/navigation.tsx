import type { ReactNode } from "react";

export function DashboardNavigation({ children }: { children: ReactNode }) {
  return <nav aria-label="Painel" className="grid grid-cols-2 gap-2 rounded-card border border-line bg-surface p-2 sm:flex sm:flex-wrap sm:gap-2">{children}</nav>;
}
