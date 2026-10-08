import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  labelledBy,
  children,
}: {
  id?: string;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("scroll-mt-24 py-16 lg:py-28", className)}>
      <div className="mx-auto w-full max-w-[1120px] px-5">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-semibold leading-[1.3] text-pix">{children}</p>;
}

export function SectionTitle({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("mt-2 font-display text-[1.75rem] font-bold leading-[1.08] tracking-[-0.025em] text-ink lg:text-[2.75rem]", className)}>
      {children}
    </h2>
  );
}
