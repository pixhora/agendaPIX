import { useId } from "react";
import { aroGlyph } from "@/lib/brand/mark";
import { cn } from "@/lib/utils";

export const GRADE_LOADER_SIZES = [24, 32, 64, 96] as const;
export type GradeLoaderSize = (typeof GRADE_LOADER_SIZES)[number];

export type GradeLoaderProps = {
  /** Texto para o leitor. No loop vira o status; na entrada única, só um nome opcional. */
  label?: string;
  /** Loop contínuo do brilho. Sem loop, a marca entra uma vez e termina no anel sólido. */
  loop?: boolean;
  /** Lado do azulejo. Só estes quatro, para não depender de style inline. */
  size?: GradeLoaderSize;
  className?: string;
};

function AroLoaderGlyph({ maskId }: { maskId: string }) {
  const { viewBox, ring, stem } = aroGlyph;
  const outer = ring.r + ring.strokeWidth / 2;
  const inner = ring.r - ring.strokeWidth / 2;

  return (
    <svg viewBox={`0 0 ${viewBox} ${viewBox}`} className="grade-svg" aria-hidden="true" overflow="visible">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect width={viewBox} height={viewBox} fill="black" />
          <circle cx={ring.cx} cy={ring.cy} r={outer} fill="white" />
          <circle cx={ring.cx} cy={ring.cy} r={inner} fill="black" />
        </mask>
      </defs>
      <circle className="grade-ring" cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="var(--pix-bright)" strokeWidth={ring.strokeWidth} />
      <foreignObject className="grade-sweep" x="0" y="0" width={viewBox} height={viewBox} mask={`url(#${maskId})`}>
        <div className="grade-conic" />
      </foreignObject>
      <rect className="grade-stem" x={stem.x} y={stem.y} width={stem.width} height={stem.height} rx={stem.rx} fill="currentColor" />
    </svg>
  );
}

/**
 * Marca Aro carregando. A geometria vem de aroGlyph.
 * Desenho original do AgendaPix; a marca estática fica no #26.
 */
export function GradeLoader({ label, loop = true, size = 32, className }: GradeLoaderProps) {
  const maskId = `aro${useId().replace(/:/g, "")}`;
  const glyph = <AroLoaderGlyph maskId={maskId} />;
  const classes = cn("grade-loader", loop && "is-loop", className);

  if (loop) {
    return (
      <span role="status" data-testid="grade-loader" data-size={size} className={classes}>
        <span className="sr-only">{label ?? "Carregando"}</span>
        {glyph}
      </span>
    );
  }

  return (
    <span
      data-testid="grade-loader"
      data-size={size}
      className={classes}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {glyph}
    </span>
  );
}
