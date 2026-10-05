import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <main id="content" role="status" aria-label="Carregando painel" className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
    <p className="sr-only">Carregando painel…</p>
    <div aria-hidden="true" className="space-y-2"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-80 max-w-full" /></div>
    <div aria-hidden="true" className="flex gap-2"><Skeleton className="size-11 rounded-full" /><Skeleton className="h-11 w-20 rounded-full" /><Skeleton className="size-11 rounded-full" /><Skeleton className="h-11 w-40 rounded-full" /></div>
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-[1.35fr_1fr_1fr]"><Skeleton className="col-span-2 h-36 rounded-[22px] lg:col-span-1" /><Skeleton className="h-36 rounded-card" /><Skeleton className="h-36 rounded-card" /></div>
    {[0, 1, 2].map((item) => <Skeleton key={item} aria-hidden="true" className="h-20 rounded-card" />)}
  </main>;
}
