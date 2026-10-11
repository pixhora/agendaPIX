import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { HoursPrototypes } from "@/components/dev/hours-prototypes";
import { mpFixturesAllowed } from "@/lib/mercadopago/dev-fixtures";

export const metadata: Metadata = {
  title: "Protótipo de horários",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const businesses = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Barbearia do Teteu" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Studio da Ana" },
];

/**
 * Protótipo de horários. Mesmo guard de `/dev/mp-fixtures`: 404 em produção.
 * Não substitui a tela real em Configurações.
 */
export default async function HoursPrototypePage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  if (!mpFixturesAllowed()) notFound();
  const { businessId } = await searchParams;
  const current = businesses.find((business) => business.id === businessId)?.id ?? businesses[0].id;
  return (
    <DashboardShell
      title="Agenda de Barbearia do Teteu"
      description="Protótipo de horários de atendimento. A tela real, em Configurações, continua igual."
      path="/dev/horarios"
      businesses={businesses}
      businessId={current}
    >
      <HoursPrototypes />
    </DashboardShell>
  );
}
