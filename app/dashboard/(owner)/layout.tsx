import { requireOwner } from "@/lib/dashboard/session";
import { Logout } from "@/components/dashboard/logout";
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  return <><a href="#content" className="sr-only focus:not-sr-only focus:block focus:p-4">Ir para o conteúdo</a><header className="border-b border-border px-4 py-4 sm:px-8"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><p className="font-semibold">Seu painel <span className="ml-2 font-normal text-muted-foreground">{owner.name}</span></p><Logout /></div></header>{children}</>;
}
