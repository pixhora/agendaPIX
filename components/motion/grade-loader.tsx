import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type GradeLoaderProps = {
  /** Nome acessível. O glifo não é lido de novo. */
  label?: string;
  /** Loop contínuo do brilho. Sem loop, a marca entra uma vez (1,1 s). */
  loop?: boolean;
  /** Lado do azulejo, em px. 24, 32, 64 e 96 acompanham o raio do BrandMark. */
  size?: number;
  className?: string;
};

/**
 * Marca Aro carregando: anel em verde-água e haste à direita.
 * Desenho original do AgendaPix. A troca da marca estática fica fora daqui.
 */
export function GradeLoader({
  label = "Carregando",
  loop = true,
  size = 32,
  className,
}: GradeLoaderProps) {
  const style = { "--grade-size": `${size}px` } as CSSProperties;

  return (
    <span
      role="status"
      aria-label={label}
      data-testid="grade-loader"
      className={cn("grade-loader", loop && "is-loop", className)}
      style={style}
    >
      <span className="grade-glyph" aria-hidden="true">
        <span className="grade-ring" />
        <span className="grade-stem" />
      </span>
    </span>
  );
}
