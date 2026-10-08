import "@/app/motion.css";
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

function arcDash(circumference: number, fraction: number) {
  const drawn = (circumference * fraction).toFixed(2);
  const gap = (circumference * (1 - fraction)).toFixed(2);
  return `${drawn} ${gap}`;
}

function AroLoaderGlyph() {
  const { viewBox, ring, stem } = aroGlyph;
  const circumference = 2 * Math.PI * ring.r;
  const circle = {
    cx: ring.cx,
    cy: ring.cy,
    r: ring.r,
    fill: "none" as const,
    strokeWidth: ring.strokeWidth,
  };

  return (
    <svg viewBox={`0 0 ${viewBox} ${viewBox}`} className="grade-svg" aria-hidden="true" overflow="visible">
      <circle className="grade-ring" {...circle} stroke="var(--pix-bright)" />
      <g className="grade-sweep">
        <g className="grade-conic">
          <circle className="grade-arc grade-arc-base" {...circle} />
          <circle className="grade-arc grade-arc-mid" {...circle} strokeDasharray={arcDash(circumference, 0.55)} />
          <circle className="grade-arc grade-arc-hot" {...circle} strokeDasharray={arcDash(circumference, 0.34)} />
          <circle className="grade-arc grade-arc-tip" {...circle} strokeDasharray={arcDash(circumference, 0.14)} />
        </g>
      </g>
      <rect className="grade-stem" x={stem.x} y={stem.y} width={stem.width} height={stem.height} rx={stem.rx} fill="currentColor" />
    </svg>
  );
}

/**
 * Marca Aro carregando. A geometria vem de aroGlyph.
 * Desenho original do AgendaPix; a marca estática fica no #26.
 */
export function GradeLoader({ label, loop = true, size = 32, className }: GradeLoaderProps) {
  const glyph = <AroLoaderGlyph />;
  const classes = cn("grade-loader", loop && "is-loop", className);

  if (loop) {
    return (
      <span role="status" data-testid="grade-loader" data-size={size} className={classes}>
        <span className="sr-only">{label ?? "Carregando"}</span>
        {glyph}
      </span>
    );
  }

  if (!label) {
    return (
      <span data-testid="grade-loader" data-size={size} className={classes} aria-hidden="true">
        {glyph}
      </span>
    );
  }

  return (
    <span role="img" data-testid="grade-loader" data-size={size} className={classes} aria-label={label}>
      {glyph}
    </span>
  );
}
