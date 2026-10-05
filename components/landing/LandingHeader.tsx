import Link from "next/link";
import { BrandLink } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
  { href: "#perguntas-frequentes", label: "Dúvidas" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandLink />
        <nav aria-label="Seções da página" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted transition-feedback hover:text-ink">{link.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="hidden lg:inline-flex" />
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink hover:bg-subtle">Entrar</Link>
          <Link href="/onboarding" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>Criar agenda grátis</Link>
        </div>
      </div>
    </header>
  );
}
