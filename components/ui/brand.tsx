import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/ui/brand-mark";

export { BrandMark };

/** Lockup horizontal. O nome acessível inclui o texto visível "AgendaPix". */
export function BrandLink({ href = "/", className }: { href?: string; className?: string }) {
  const accessibleName = href === "/dashboard" ? "AgendaPix, início do painel" : "AgendaPix, página inicial";
  return (
    <Link href={href} aria-label={accessibleName} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-field text-ink", className)}>
      <BrandMark />
      <span className="relative -top-0.5 font-display text-lg leading-none tracking-[-0.02em]">
        <span className="font-bold">Agenda</span>
        <span className="font-extrabold text-pix">Pix</span>
      </span>
    </Link>
  );
}
