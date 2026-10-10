import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main id="content" role="status" aria-label="Carregando agendamento" className="mx-auto min-h-dvh w-full max-w-xl px-4 py-8">
      <p className="sr-only">Carregando agendamento…</p>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-28 w-full rounded-card" />
      </div>
    </main>
  );
}
