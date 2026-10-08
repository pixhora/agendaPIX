import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandLink } from "@/components/ui/brand";
import { StatusBadge } from "@/components/ui/status-badge";
import { ValueSlab } from "@/components/ui/value-slab";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getOwnerSession } from "@/lib/dashboard/auth-session";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Entrar · AgendaPix",
  robots: { index: false },
};

type SearchParams = Promise<{ error?: string | string[]; next?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const previewRows = [
  { time: "09:00", name: "Marina", service: "Corte", status: "confirmed" as const },
  { time: "10:30", name: "Bruno", service: "Corte e barba", status: "confirmed" as const },
  { time: "16:30", name: "Carla", service: "Barba", status: "pending_payment" as const },
];

/** Login único do app (dono do negócio): link mágico do Better Auth na mesma origem. */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const linkError = Boolean(first(params.error));

  let signedIn = false;
  if (!linkError) {
    try {
      signedIn = (await getOwnerSession(await headers())) !== null;
    } catch {
      // Sem conseguir verificar a sessão, mostra o formulário normalmente.
    }
  }
  if (signedIn) redirect(next);

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-8">
          <BrandLink />
          <Link href="/onboarding" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink hover:bg-subtle">
            Criar conta
          </Link>
        </header>
        <main id="content" className="flex flex-1 items-center px-4 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-sm">
            <LoginForm callbackURL={next} linkError={linkError} />
          </div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted sm:px-8">
          <span>Acesso sem senha, por link de uso único.</span>
          <ThemeToggle />
        </footer>
      </div>

      <aside aria-label="Prévia do painel" className="relative hidden overflow-hidden bg-slab p-10 text-slab-foreground lg:flex lg:flex-col lg:justify-center xl:p-16">
        <div aria-hidden="true" className="bg-dots absolute inset-0 opacity-[0.07]" />
        <div className="relative mx-auto w-full max-w-md space-y-5">
          <p className="font-display text-3xl font-extrabold leading-tight tracking-tight">Sua agenda de hoje, com os sinais já pagos no Pix.</p>
          <ValueSlab size="compact" className="bg-white/[0.06] ring-white/10" label="Sinais confirmados hoje" value="R$ 55,00" badge="5 pagos" sublabel="Caiu na sua conta antes do cliente chegar." />
          <ul className="divide-y divide-white/10 rounded-card bg-white/[0.06] ring-1 ring-white/10">
            {previewRows.map((row) => (
              <li key={row.time} className="flex items-center gap-4 px-4 py-3">
                <span className="w-12 font-display font-bold tabular-nums">{row.time}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{row.name}</span><span className="block truncate text-sm text-slab-muted">{row.service}</span></span>
                <StatusBadge status={row.status} compact className="border-white/15 bg-white/10 text-slab-foreground" />
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
