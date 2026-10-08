import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca: monograma + "AgendaPix". O ponto verde-água remete ao Pix. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative flex size-8 items-center justify-center rounded-[10px] bg-ink font-display text-sm font-extrabold text-paper", className)}>
      A
      <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-paper bg-pix-bright" />
    </span>
  );
}

export function BrandLink({ href = "/", className, label = "AgendaPix" }: { href?: string; className?: string; label?: string }) {
  return (
    <Link href={href} aria-label={`${label}, página inicial`} className={cn("inline-flex min-h-11 items-center gap-2.5 rounded-field font-display text-lg font-bold tracking-tight text-ink", className)}>
      <BrandMark />
      <span>{label}</span>
    </Link>
  );
}
