import { cn } from "@/lib/utils";

/** Placeholder de carregamento sobre `--subtle` (nunca sobre a cor de texto `--muted`). */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-field bg-subtle motion-reduce:animate-none", className)} {...props} />;
}
