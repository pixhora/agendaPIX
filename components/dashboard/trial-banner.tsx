import { Check, Clock, Pause, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  pendingRequestCopy,
  receivedWhenPhrase,
  renewalDueCopy,
  SUBSCRIPTION_PENDING_TITLE,
  SUBSCRIPTION_UNAVAILABLE_COPY,
  SUBSCRIPTION_WHATSAPP_LABEL,
  subscribeHelpCopy,
  subscriptionCheckoutAction,
  subscriptionCta,
} from "@/lib/billing/checkout";
import {
  formatPlanReais,
  formatTrialEnd,
  formatTrialEndLong,
  renewCtaLabel,
  subscribeCtaLabel,
  trialCopy,
  trialTone,
  type BillingView,
} from "@/lib/dashboard/trial-notice";
import { SubscriptionCheckoutForm } from "./subscription-checkout-form";
import { TrialChangesDialog } from "./trial-changes-dialog";

const KEEPS = [
  "Reservas já feitas continuam valendo",
  "Você edita serviços, horários e a política do sinal",
] as const;

export function TrialBanner({
  billing,
  businessId,
  timeZone,
  publicHref,
  now = new Date(),
}: {
  billing: BillingView;
  businessId: string;
  timeZone: string;
  publicHref?: string;
  now?: Date;
}) {
  const tone = trialTone(billing);
  const endLabel = tone === "paused" ? formatTrialEndLong(billing.trialEndsAt, timeZone) : formatTrialEnd(billing.trialEndsAt, timeZone);
  const copy = trialCopy(billing, endLabel);
  const price = formatPlanReais(billing.plan.priceCents);
  const action = subscriptionCheckoutAction(businessId);
  const cta = subscriptionCta(billing, now, timeZone);
  const pendingWhen = cta.kind === "pending" && cta.requestedAt ? receivedWhenPhrase(cta.requestedAt, now, timeZone) : null;
  const renewal = cta.kind === "renew" ? renewalDueCopy(cta.periodEnd, timeZone) : null;

  if (cta.kind === "renew" && renewal && action) {
    return (
      <section role="region" aria-label="Aviso da assinatura" className="rounded-card border border-line bg-surface p-4">
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink">{renewal}</p>
        <div className="mt-3">
          <SubscriptionCheckoutForm action={action}>
            <Button type="submit" className="w-full bg-pix-bright text-[#0b0b0c] hover:bg-pix-bright sm:w-auto">{renewCtaLabel(billing.plan.priceCents)}<span className="sr-only"> (abre em nova aba)</span></Button>
          </SubscriptionCheckoutForm>
        </div>
      </section>
    );
  }

  if (!copy || tone === "none") return null;

  return (
    <>
      {tone === "discreet" && (
        <div role="region" aria-label="Aviso da assinatura" className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card border border-line bg-surface px-4 py-3">
          <p className="min-w-0 text-sm"><span className="font-semibold">{copy.title}</span> <span className="text-muted">· {copy.body}</span></p>
          <TrialChangesDialog planName={billing.plan.name} priceLabel={price} checkoutAvailable={billing.checkout.available} variant="outline" className="shrink-0" />
        </div>
      )}
      {tone === "strong" && (
        <section role="region" aria-label="Aviso da assinatura" className="rounded-card border border-warning/30 bg-warning-soft p-4">
          <div className="flex items-start gap-3">
            <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-ink">{copy.title}</h2>
              <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-ink">{copy.body}</p>
            </div>
          </div>
          <div className="mt-3">
            <TrialChangesDialog planName={billing.plan.name} priceLabel={price} checkoutAvailable={billing.checkout.available} variant="outline" className="w-full sm:w-auto" />
          </div>
        </section>
      )}
      {tone === "paused" && (
        <section role="region" aria-label="Aviso da assinatura" className="rounded-card bg-slab p-4 text-slab-foreground sm:p-5">
          <div className="flex items-start gap-3">
            <Pause aria-hidden="true" className="mt-1 size-5 shrink-0 text-pix-bright" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold">{copy.title}</h2>
              <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-slab-muted">{copy.body}</p>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 text-sm">
            {KEEPS.map((item) => <li key={item} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix-bright" />{item}</li>)}
            <li className="flex items-start gap-2"><X aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix-bright" />Clientes não marcam horários novos</li>
          </ul>
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-slab-muted">
            Sua página mostra que o agendamento online está pausado.
            {publicHref && <> <a href={publicHref} target="_blank" rel="noopener noreferrer" className="font-semibold leading-[inherit] text-pix-bright underline decoration-1 underline-offset-2">Ver como fica<span className="sr-only"> (abre em nova aba)</span></a></>}
          </p>
          <div className="mt-4 flex flex-col items-start gap-2">
            {cta.kind === "subscribe" && action && (
              <>
                <SubscriptionCheckoutForm action={action}>
                  <Button type="submit" className="w-full bg-pix-bright text-[#0b0b0c] hover:bg-pix-bright sm:w-auto">{subscribeCtaLabel(billing.plan.priceCents)}<span className="sr-only"> (abre em nova aba)</span></Button>
                </SubscriptionCheckoutForm>
                <p className="max-w-[62ch] text-sm leading-relaxed text-slab-muted">{subscribeHelpCopy(cta.activationHours)}</p>
              </>
            )}
            {cta.kind === "pending" && pendingWhen && (
              <div className="grid max-w-[62ch] gap-1">
                <p className="font-display text-base font-bold">{SUBSCRIPTION_PENDING_TITLE}</p>
                <p className="text-sm leading-relaxed">{pendingRequestCopy(pendingWhen, cta.activationHours)}</p>
              </div>
            )}
            {cta.kind === "pending" && cta.allowResend && action && (
              <SubscriptionCheckoutForm action={action}>
                <Button type="submit" variant="outline" className="w-full sm:w-auto">{SUBSCRIPTION_WHATSAPP_LABEL}<span className="sr-only"> (abre em nova aba)</span></Button>
              </SubscriptionCheckoutForm>
            )}
            {cta.kind === "unavailable" && <p className="max-w-[62ch] text-sm leading-relaxed text-slab-muted">{SUBSCRIPTION_UNAVAILABLE_COPY}</p>}
            <TrialChangesDialog planName={billing.plan.name} priceLabel={price} checkoutAvailable={billing.checkout.available} variant="text" />
          </div>
        </section>
      )}
    </>
  );
}
