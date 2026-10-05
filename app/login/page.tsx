import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getOwnerSession } from "@/lib/dashboard/auth-session";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Entrar · Agenda",
  robots: { index: false },
};

type SearchParams = Promise<{ error?: string | string[]; next?: string | string[] }>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header Compacto */}
      <header className="border-b border-border bg-surface py-2 px-4 sm:px-6">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-foreground min-h-11 py-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-forest text-xs font-black text-primary">
              A
            </span>
            <span>Agenda</span>
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center text-xs font-semibold text-primary hover:underline min-h-11 px-2 -mr-2"
          >
            Criar conta
          </Link>
        </div>
      </header>

      {/* Conteúdo Centralizado */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-10 flex flex-col justify-center">
        <LoginForm callbackURL={next} linkError={linkError} />
      </main>
    </div>
  );
}
