import type { Metadata } from "next";
import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { BrandLink } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex min-h-16 items-center px-4 sm:px-6">
        <BrandLink />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-[14px] bg-danger-soft text-danger">
          <MapPinOff aria-hidden="true" className="size-6" strokeWidth={2} />
        </div>
        <h1 className="mt-6 max-w-[20ch] font-display text-[1.375rem] font-bold tracking-tight sm:text-[1.75rem]">Não encontramos essa página.</h1>
        <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-muted">O link pode ter mudado. Volte ao início ou crie a sua agenda.</p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link href="/" className={buttonVariants({ className: "w-full sm:w-auto" })}>Ir para o início</Link>
          <Link href="/onboarding" className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}>Criar minha agenda</Link>
        </div>
      </main>
    </div>
  );
}
