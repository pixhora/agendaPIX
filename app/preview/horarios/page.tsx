import { HoursForm } from "@/components/dashboard/forms";

const BUSINESS_ID = "4eeb8372-55cd-4d11-910e-62d4e4374011";

const hours = [1, 2, 3, 4, 5].flatMap((weekday) => weekday === 1
  ? [
      { weekday, opensAt: "09:00", closesAt: "12:00" },
      { weekday, opensAt: "14:00", closesAt: "18:00" },
    ]
  : [{ weekday, opensAt: "09:00", closesAt: "18:00" }]);

export default async function PreviewHoursPage({ searchParams }: { searchParams: Promise<{ breaks?: string }> }) {
  const { breaks } = await searchParams;
  const multiInterval = breaks === "1";
  return <main className="mx-auto min-w-0 max-w-3xl px-4 py-6">
    <h1 className="font-display text-2xl font-extrabold">Horários de funcionamento</h1>
    <p className="mt-1 text-sm text-muted">Fuso horário: Horário de Brasília.</p>
    <div className="mt-4 rounded-card border border-line bg-surface p-4 sm:p-6">
      <HoursForm key={String(multiInterval)} businessId={BUSINESS_ID} hours={hours} multiInterval={multiInterval} />
    </div>
  </main>;
}
