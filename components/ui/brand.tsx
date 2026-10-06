import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca oficial agendaPIX: calendário cream + check mint no squircle charcoal. */
export function BrandMark({ className, size = 32, priority = false }: { className?: string; size?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/agendapix-icon.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
      priority={priority}
    />
  );
}

export function BrandLink({
  href = "/",
  className,
  label = "Agenda",
  markSize = 32,
  priority = false,
}: {
  href?: string;
  className?: string;
  label?: string;
  markSize?: number;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}, página inicial`}
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-field font-display text-lg font-bold tracking-tight text-ink",
        className,
      )}
    >
      <BrandMark size={markSize} priority={priority} />
      <span>{label}</span>
    </Link>
  );
}
