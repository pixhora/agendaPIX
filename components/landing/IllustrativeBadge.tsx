import { cn } from "@/lib/utils";

export function IllustrativeBadge({ className }: { className?: string }) {
  return (
    <span className={cn("text-[10px] font-medium leading-none text-muted", className)}>
      Exemplo ilustrativo
    </span>
  );
}
