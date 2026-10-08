import { ServiceForm } from "@/components/dashboard/forms";
import { ServiceBlockNotice } from "@/components/dashboard/service-block-notice";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { depositPolicyPresets, type DepositPolicy } from "@/lib/policy/schema";
import { policyListLabel } from "@/lib/policy/text";
import type { BillingView } from "@/lib/dashboard/trial-notice";

const BUSINESS_ID = "4eeb8372-55cd-4d11-910e-62d4e4374011";
const SERVICE_ID = "8b6d8a2e-1c4a-4f0e-9a11-6e5c2b7d9f10";

const PERSONALIZADA = {
  version: 1,
  preset: "personalizada",
  refundUntilHours: 48,
  rescheduleUntilHours: 12,
  maxReschedules: 1,
  lateCancel: "retain",
  noShow: "credit",
  creditValidityDays: 60,
} as const satisfies DepositPolicy;

function policyFor(preset: string | undefined): DepositPolicy {
  if (preset === "flexivel" || preset === "padrao" || preset === "rigida") return depositPolicyPresets[preset];
  return PERSONALIZADA;
}

function billing(patch: Partial<BillingView>): BillingView {
  return {
    state: "trial",
    trialEndsAt: "2026-10-20T02:59:59.000Z",
    daysLeft: 5,
    bookingsPaused: false,
    plan: { name: "AgendaPix", priceCents: 4900 },
    subscription: null,
    ...patch,
  };
}

const BLOCKS = [
  { id: "livre", name: "Corte", reason: null },
  { id: "pausa", name: "Barba", reason: "bookings_paused" },
  { id: "mp", name: "Sobrancelha", reason: "mp_account_not_connected" },
] as const;

export default async function PreviewPainelPage({ searchParams }: { searchParams: Promise<{ scene?: string; preset?: string; tone?: string }> }) {
  const query = await searchParams;
  const scene = query.scene ?? "politica";
  const policy = policyFor(query.preset);
  const tone = query.tone ?? "discreet";
  const trial = tone === "paused"
    ? billing({ state: "paused", daysLeft: -1, bookingsPaused: true, trialEndsAt: "2026-10-14T02:59:59.000Z" })
    : tone === "strong"
      ? billing({ state: "trial_ending", daysLeft: 2, trialEndsAt: "2026-10-18T02:59:59.000Z" })
      : billing({ state: "trial", daysLeft: 5 });

  return <main className="mx-auto min-w-0 max-w-3xl px-4 py-6">
    <h1 className="font-display text-2xl font-extrabold">Prévia do painel</h1>
    {scene === "politica" && <div className="mt-4 rounded-card border border-line bg-surface p-4 sm:p-6">
      <ServiceForm
        businessId={BUSINESS_ID}
        businessName="Studio Bella"
        futureBookingsCount={0}
        service={{ id: SERVICE_ID, name: "Design de sobrancelha", durationMinutes: 45, priceCents: 6000, depositCents: 2000, active: true, depositPolicy: policy }}
      />
    </div>}
    {scene === "aviso" && <div className="mt-4 rounded-card border border-line bg-surface p-4 sm:p-6">
      <ServiceForm
        businessId={BUSINESS_ID}
        businessName="Studio Bella"
        futureBookingsCount={2}
        service={{ id: SERVICE_ID, name: "Design de sobrancelha", durationMinutes: 45, priceCents: 6000, depositCents: 2000, active: true, depositPolicy: depositPolicyPresets.padrao }}
      />
    </div>}
    {scene === "lista" && <ul className="mt-4 grid gap-3">
      {BLOCKS.map((item) => <li key={item.id} className="rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-bold">{item.name}</h2>
        <p className="text-sm font-semibold text-pix">Sinal Pix R$ 20,00</p>
        <p className="text-sm text-muted">{policyListLabel(depositPolicyPresets.padrao, 2000)}</p>
        <ServiceBlockNotice reason={item.reason} />
        {item.reason === null && <p className="mt-3 text-sm text-muted">Clientes podem reservar este serviço.</p>}
      </li>)}
    </ul>}
    {scene === "trial" && <div className="mt-4"><TrialBanner billing={trial} timeZone="America/Sao_Paulo" publicHref="/studio-bella" /></div>}
  </main>;
}
