import { DashboardShell, Empty } from "@/components/dashboard/shell";
import { HoursForm } from "@/components/dashboard/forms";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardHours } from "@/lib/dashboard/data";
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const hours = business ? await dashboardHours(owner.id, business.id) : [];
  return <DashboardShell title="Horários de funcionamento" description={business ? `Defina seus dias de atendimento. Fuso: ${business.timezone}.` : "Defina seus dias de atendimento."} path="/dashboard/settings" businesses={businesses} businessId={business?.id}>
    {business && <div className="max-w-3xl space-y-6">{!hours.length && <Empty title="Sua agenda está fechada">Marque os dias de atendimento e salve os horários para receber agendamentos.</Empty>}<HoursForm key={business.id} businessId={business.id} hours={hours} /></div>}
  </DashboardShell>;
}
