import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/ui/brand";
import { InView } from "@/components/motion/in-view";

export type GradeLoaderProps = {
  label?: string;
  className?: string;
};

/** A Grade A acende em sequência. A geometria vem da marca, sem cópia do desenho. */
export function GradeLoader({ label = "Carregando…", className }: GradeLoaderProps) {
  return (
    <InView role="status" data-testid="grade-loader" className={cn("grade-loader inline-flex flex-col items-center gap-3", className)}>
      <BrandMark className="size-20" />
      <span className="text-sm text-muted">{label}</span>
    </InView>
  );
}
