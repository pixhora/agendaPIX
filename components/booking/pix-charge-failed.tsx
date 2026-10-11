import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PIX_CHARGE_FAILED_BODY, PIX_CHARGE_FAILED_RETRY, PIX_CHARGE_FAILED_TITLE, PIX_GENERATING_LABEL, TALK_TO_STORE } from "./customer-copy";

/** Recusa do Pix na reserva. O botão principal pede de novo com outra Idempotency-Key. */
export function PixChargeFailedScreen({
  storeHref,
  onRetry,
  retrying,
}: {
  storeHref: string | null;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="space-y-4">
      <div role="alert" aria-live="assertive" className="space-y-3 rounded-card border border-line bg-surface p-6 text-center">
        <h2 className="font-display text-xl font-bold text-ink">{PIX_CHARGE_FAILED_TITLE}</h2>
        <p className="text-sm text-ink">{PIX_CHARGE_FAILED_BODY}</p>
      </div>
      <div className="space-y-2">
        <Button type="button" size="lg" className="w-full" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
          {retrying ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
          {retrying ? PIX_GENERATING_LABEL : PIX_CHARGE_FAILED_RETRY}
        </Button>
        {storeHref ? (
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href={storeHref} target="_blank" rel="noopener noreferrer">{TALK_TO_STORE}</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
