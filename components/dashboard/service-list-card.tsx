import Link from "next/link";
import { Pencil } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { SUMMARY_ICONS } from "@/lib/icons/registry";
import { ServiceForm } from "@/components/dashboard/forms";
import { ServiceBlockNotice } from "@/components/dashboard/service-block-notice";
import { policyListLabel } from "@/lib/policy/text";
import type { DepositPolicy } from "@/lib/policy/schema";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export type ServiceListCardService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  active: boolean;
  depositPolicy: DepositPolicy;
  imageUrl?: string | null;
  blockedReason: string | null;
};

export function ServiceListCard({
  service,
  businessId,
  businessName,
  contactWhatsapp,
}: {
  service: ServiceListCardService;
  businessId: string;
  businessName: string;
  contactWhatsapp: string | null;
}) {
  return (
    <li className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="min-w-0">
        <h3 className="break-words font-display text-lg font-bold tracking-tight">{service.name}</h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <Icon icon={SUMMARY_ICONS.duration} className="text-muted" />
            {service.durationMinutes} min
          </span>
          <span className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 text-xs font-semibold", service.active ? "bg-success-soft text-success" : "bg-subtle text-muted")}>
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", service.active ? "bg-success" : "bg-line-strong")} />
            {service.active ? "Disponível" : "Indisponível"}
          </span>
        </p>
        <div className="mt-3 text-left tabular-nums">
          <p className="font-display text-xl font-extrabold">{money.format(service.priceCents / 100)}</p>
          <p className="mt-1 text-sm font-semibold text-pix">{service.depositCents > 0 ? `Sinal Pix ${money.format(service.depositCents / 100)}` : "Sem sinal"}</p>
          <p className="mt-1 break-words text-sm text-muted">{policyListLabel(service.depositPolicy, service.depositCents)}</p>
          {service.blockedReason === "mp_account_not_connected" ? <p className="mt-2 max-w-prose text-sm text-ink">Conecte a conta Mercado Pago no AgendaPix para o cliente pagar o sinal deste serviço.</p> : null}
          {service.blockedReason === "mp_consent_outdated" ? <p className="mt-2 max-w-prose text-sm text-ink"><Link href={`/dashboard/settings?businessId=${businessId}#recebimento`} className="font-semibold underline underline-offset-4">Aceite o texto novo em Recebimento</Link> para voltar a receber sinal. Não precisa reconectar o Mercado Pago.</p> : null}
        </div>
      </div>
      <ServiceBlockNotice reason={service.blockedReason} />
      <details className="group mt-3 border-t border-line pt-1">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-field text-sm font-semibold text-ink hover:text-pix focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <Pencil aria-hidden="true" className="size-4" />
          Editar serviço
          <span className="sr-only"> {service.name}</span>
        </summary>
        <div className="mt-2 rounded-field bg-subtle/60 p-3 sm:p-4">
          <ServiceForm key={service.id} businessId={businessId} businessName={businessName} contactWhatsapp={contactWhatsapp} service={service} />
        </div>
      </details>
    </li>
  );
}
