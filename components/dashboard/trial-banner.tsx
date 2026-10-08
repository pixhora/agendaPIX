import { Check, Clock, Pause, X } from "lucide-react";
import { subscriptionCheckoutAction, subscriptionCta } from "@/lib/dashboard/subscription-ui";
import {
  formatPlanReais,
  formatTrialEnd,
  formatTrialEndLong,
  trialCopy,
  trialTone,
  type BillingView,
} from "@/lib/dashboard/trial-notice";
import { SubscriptionCheckout } from "./subscription-checkout";
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

  if (cta.kind === "renew") {
    return (
      <section role="region" aria-label="Aviso da assinatura" className="rounded-card border border-line bg-surface p-4">
        <div className="flex flex-col items-start gap-3">
          <SubscriptionCheckout cta={cta} priceCents={billing.plan.priceCents} action={action} now={now} timeZone={timeZone} surface="paper" />
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
            <SubscriptionCheckout cta={cta} priceCents={billing.plan.priceCents} action={action} now={now} timeZone={timeZone} surface="slab" />
            <TrialChangesDialog planName={billing.plan.name} priceLabel={price} checkoutAvailable={billing.checkout.available} variant="text" />
          </div>
        </section>
      )}
    </>
  );
}
