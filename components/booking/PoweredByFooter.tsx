import Link from "next/link";
import { aroGlyph } from "@/lib/brand/mark";
import { POWERED_BY_LEAD, POWERED_BY_LINK_LABEL, poweredByHref, type PoweredByCampaign } from "@/lib/brand/powered-by";

/** Símbolo Aro em 16 px. Decorativo: o texto ao lado já diz AgendaPix. */
function AgendaPixSymbol() {
  const { viewBox, ring, stem } = aroGlyph;
  return (
    <svg viewBox={`0 0 ${viewBox} ${viewBox}`} aria-hidden="true" className="inline-block size-4 shrink-0 align-[-0.2em] text-muted-foreground">
      <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="var(--pix-bright)" strokeWidth={ring.strokeWidth} />
      <rect x={stem.x} y={stem.y} width={stem.width} height={stem.height} rx={stem.rx} fill="currentColor" />
    </svg>
  );
}

/**
 * Atribuição discreta. 24 px acima do separador (`mt-6`), texto `text-xs text-muted-foreground`.
 * O link ocupa pelo menos 44 px de altura.
 */
export function PoweredByFooter({ campaign }: { campaign: PoweredByCampaign }) {
  return (
    <div data-testid="powered-by-footer" data-campaign={campaign} className="mt-6 w-full min-w-0 border-t border-line pt-4 text-center">
      <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
        <AgendaPixSymbol />{" "}
        <span>{POWERED_BY_LEAD} </span>
        <Link
          href={poweredByHref(campaign)}
          data-testid="powered-by-link"
          className="inline-flex min-h-11 items-center underline decoration-current underline-offset-4 hover:text-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {POWERED_BY_LINK_LABEL}
        </Link>
      </p>
    </div>
  );
}
