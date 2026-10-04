import { DashboardShell, Empty } from "@/components/dashboard/shell";
import { HoursForm } from "@/components/dashboard/forms";
import { PixKeyForm } from "@/components/dashboard/pix-key-form";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardHours } from "@/lib/dashboard/data";
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const hours = business ? await dashboardHours(owner.id, business.id) : [];
  return <DashboardShell title="Horários de funcionamento" description={business ? `Defina seus dias de atendimento. Fuso: ${business.timezone}.` : "Defina seus dias de atendimento."} path="/dashboard/settings" businesses={businesses} businessId={business?.id}>
    {business && <div className="max-w-3xl space-y-5">{!hours.length && <Empty title="Sua agenda está fechada">Marque os dias de atendimento e salve os horários para receber agendamentos.</Empty>}<section className="rounded-xl border border-border bg-background p-4 sm:p-6"><div className="mb-5 border-b border-border pb-4"><h2 className="text-lg font-semibold">Dias e horários</h2><p className="mt-1 text-sm text-muted-foreground">Cada dia pode ter um intervalo de atendimento.</p></div><HoursForm key={business.id} businessId={business.id} hours={hours} /></section><PixKeyForm key={`pix-${business.id}`} businessId={business.id} /></div>}
  </DashboardShell>;
}
