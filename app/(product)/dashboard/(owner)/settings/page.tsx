import { DashboardShell, Empty, SectionCard } from "@/components/dashboard/shell";
import { HoursForm } from "@/components/dashboard/forms";
import { PixKeyForm } from "@/components/dashboard/pix-key-form";
import { PublicLink } from "@/components/dashboard/public-link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ownerContext } from "@/lib/dashboard/session";
import { dashboardHours } from "@/lib/dashboard/data";
import { friendlyTimezoneLabel } from "@/lib/dashboard/timezone-label";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS } from "@/lib/icons/registry";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams;
  const { businesses, business, owner } = await ownerContext(businessId);
  const hours = business ? await dashboardHours(owner.id, business.id) : [];
  return <DashboardShell title="Configurações" description="Link público, dias de atendimento, chave Pix e aparência do painel." path="/dashboard/settings" businesses={businesses} businessId={business?.id}>
    {business && <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-start">
      <div className="grid min-w-0 gap-6">
        {!hours.length && <Empty title="Sua agenda está fechada" icon={<Icon icon={ACTION_ICONS.hours} size="md" />}>Ligue os dias de atendimento e salve os horários para receber agendamentos.</Empty>}
        <SectionCard title="Horários de funcionamento" headingId="hours-title" icon={<Icon icon={ACTION_ICONS.hours} size="md" />} description={`Fuso horário: ${friendlyTimezoneLabel(business.timezone)}.`}>
          <HoursForm key={business.id} businessId={business.id} hours={hours} />
        </SectionCard>
        <PixKeyForm key={`pix-${business.id}`} businessId={business.id} />
      </div>
      <div className="grid min-w-0 gap-6 lg:sticky lg:top-8">
        <SectionCard title="Sua página pública" headingId="public-link-title" icon={<Icon icon={ACTION_ICONS.link} size="md" />} description="Compartilhe este link para receber reservas com sinal via Pix.">
          <PublicLink slug={business.slug} />
        </SectionCard>
        <SectionCard title="Aparência" headingId="appearance-title" icon={<Icon icon={ACTION_ICONS.appearance} size="md" />} description="Claro, escuro ou seguir o sistema. Vale para este aparelho.">
          <ThemeToggle />
        </SectionCard>
      </div>
    </div>}
  </DashboardShell>;
}
