import Link from "next/link";
import { BrandLink } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <BrandLink />
          <p className="mt-1 text-sm text-muted">Agendamento online com sinal no Pix.</p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-2 text-sm font-medium">
          <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-muted hover:text-ink">Entrar</Link>
          <Link href="/onboarding" className="inline-flex min-h-11 items-center px-2 text-muted hover:text-ink">Criar conta</Link>
          <a href="#como-funciona" className="inline-flex min-h-11 items-center px-2 text-muted hover:text-ink">Como funciona</a>
          <a href="#precos" className="inline-flex min-h-11 items-center px-2 text-muted hover:text-ink">Preços</a>
        </nav>
        <ThemeToggle />
      </div>
      <p className="border-t border-line px-4 py-4 text-center text-xs text-muted">© {new Date().getFullYear()} AgendaPix. Feito para quem vive de atendimento no Brasil.</p>
    </footer>
  );
}
