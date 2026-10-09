import { Button } from "@/components/ui/button";
import {
  pendingRequestCopy,
  receivedWhenPhrase,
  renewalDueCopy,
  SUBSCRIPTION_PENDING_TITLE,
  SUBSCRIPTION_UNAVAILABLE_COPY,
  SUBSCRIPTION_WHATSAPP_LABEL,
  subscribeHelpCopy,
  type SubscriptionCta,
} from "@/lib/dashboard/subscription-ui";
import { renewCtaLabel, subscribeCtaLabel } from "@/lib/dashboard/trial-notice";
import { SubscriptionCheckoutForm } from "./subscription-checkout-form";

/** Única superfície do checkout. O card pausado, a renovação e o aviso do painel renderizam este bloco. */
export function SubscriptionCheckout({
  cta,
  priceCents,
  action,
  now,
  timeZone,
  surface,
}: {
  cta: SubscriptionCta;
  priceCents: number;
  action: string | null;
  now: Date;
  timeZone: string;
  surface: "slab" | "paper";
}) {
  const muted = surface === "slab" ? "text-slab-muted" : "text-muted";
  const ink = surface === "slab" ? "text-slab-foreground" : "text-ink";

  if (cta.kind === "subscribe" && action) {
    return (
      <SubscriptionCheckoutForm action={action} note={<p className={`max-w-[62ch] text-sm leading-relaxed ${muted}`}>{subscribeHelpCopy(cta.activationHours)}</p>}>
        <Button type="submit" className="w-full bg-pix-bright text-[#0b0b0c] hover:bg-pix-bright sm:w-auto">{subscribeCtaLabel(priceCents)}<span className="sr-only"> (abre em nova aba)</span></Button>
      </SubscriptionCheckoutForm>
    );
  }

  if (cta.kind === "pending") {
    const when = cta.requestedAt ? receivedWhenPhrase(cta.requestedAt, now, timeZone) : null;
    return (
      <>
        {when && (
          <div className="grid max-w-[62ch] gap-1">
            <p className="font-display text-base font-bold">{SUBSCRIPTION_PENDING_TITLE}</p>
            <p className={`text-sm leading-relaxed ${ink}`}>{pendingRequestCopy(when, cta.activationHours)}</p>
          </div>
        )}
        {cta.allowResend && action && (
          <SubscriptionCheckoutForm action={action}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">{SUBSCRIPTION_WHATSAPP_LABEL}<span className="sr-only"> (abre em nova aba)</span></Button>
          </SubscriptionCheckoutForm>
        )}
      </>
    );
  }

  if (cta.kind === "unavailable") {
    return <p className={`max-w-[62ch] text-sm leading-relaxed ${muted}`}>{SUBSCRIPTION_UNAVAILABLE_COPY}</p>;
  }

  if (cta.kind === "renew" && action) {
    const due = renewalDueCopy(cta.periodEnd, timeZone);
    if (!due) return null;
    return (
      <>
        <p className={`max-w-[62ch] text-[15px] leading-relaxed ${ink}`}>{due}</p>
        <SubscriptionCheckoutForm action={action}>
          <Button type="submit" className="w-full bg-pix-bright text-[#0b0b0c] hover:bg-pix-bright sm:w-auto">{renewCtaLabel(priceCents)}<span className="sr-only"> (abre em nova aba)</span></Button>
        </SubscriptionCheckoutForm>
      </>
    );
  }

  return null;
}
