import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main role="status" aria-label="Carregando cadastro" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-8">
      <p className="sr-only">Carregando cadastro…</p>
      <Skeleton aria-hidden="true" className="h-8 w-56 max-w-full" />
      <Skeleton aria-hidden="true" className="h-4 w-72 max-w-full" />
      <Skeleton aria-hidden="true" className="h-12 w-full rounded-field" />
      <Skeleton aria-hidden="true" className="h-12 w-full rounded-field" />
      <Skeleton aria-hidden="true" className="h-11 w-40 rounded-full" />
    </main>
  );
}
