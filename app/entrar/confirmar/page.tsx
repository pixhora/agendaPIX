import type { Metadata } from "next";
import Link from "next/link";
import { BrandLink } from "@/components/ui/brand";
import { ConfirmLoginForm } from "./confirm-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar · AgendaPix",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  const picked = Array.isArray(value) ? value[0] : value;
  return picked && picked.length > 0 ? picked : undefined;
}

/** GET só mostra o botão. A confirmação acontece no POST do formulário. */
export default async function ConfirmLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = first(params.token);

  return (
    <main id="content" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center bg-paper px-4 py-10">
      <BrandLink label="AgendaPix" />
      {token ? (
        <>
          <h1 className="mt-8 font-display text-[28px] font-extrabold leading-tight tracking-tight text-ink">Confirme para entrar</h1>
          <p className="mt-3 max-w-[36ch] text-base leading-relaxed text-muted">Toque em Entrar para abrir sua conta. Este acesso vale uma vez.</p>
          <ConfirmLoginForm
            token={token}
            callbackURL={first(params.callbackURL)}
            errorCallbackURL={first(params.errorCallbackURL)}
            newUserCallbackURL={first(params.newUserCallbackURL)}
          />
        </>
      ) : (
        <>
          <h1 className="mt-8 font-display text-[28px] font-extrabold leading-tight tracking-tight text-ink">Este link de acesso expirou ou já foi usado.</h1>
          <p className="mt-3 max-w-[36ch] text-base leading-relaxed text-muted">Peça outro link na tela de entrar.</p>
          <Link href="/login" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-base font-semibold text-paper">
            Pedir outro link
          </Link>
        </>
      )}
    </main>
  );
}
