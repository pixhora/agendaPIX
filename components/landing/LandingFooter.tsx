import Link from "next/link";
import { BrandLink } from "@/components/ui/brand";
import { legalPagesPublished, showPendingBlocks } from "@/lib/marketing/flags";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const product = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#exemplo", label: "Página de exemplo" },
  { href: "#precos", label: "Preço" },
  { href: "#perguntas-frequentes", label: "Dúvidas" },
];

export function LandingFooter() {
  const pending = showPendingBlocks();
  const legal = legalPagesPublished();
  const year = new Date().getFullYear();

  return (
    <footer id="rodape" className="border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandLink />
          <p className="mt-3 max-w-[28ch] text-sm leading-relaxed text-muted">Agenda online com sinal no Pix para quem vive de atendimento.</p>
        </div>
        <nav aria-label="Produto" className="flex flex-col">
          <p className="text-sm font-semibold text-ink">Produto</p>
          {product.map((link) => (
            <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>
        <nav aria-label="Conta" className="flex flex-col">
          <p className="text-sm font-semibold text-ink">Conta</p>
          <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">Entrar</Link>
          <Link href="/onboarding" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">Criar agenda grátis</Link>
        </nav>
        {legal ? (
          <nav aria-label="Legal" className="flex flex-col">
            <p className="text-sm font-semibold text-ink">Legal</p>
            <Link href="/termos" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">Termos de uso</Link>
            <Link href="/privacidade" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">Política de privacidade</Link>
          </nav>
        ) : null}
        {pending ? (
          <div>
            <p className="text-sm font-semibold text-ink">Contato</p>
            <p className="mt-2 text-sm text-muted">[e-mail de suporte]</p>
            <p className="mt-1 text-sm text-muted">[WhatsApp]</p>
          </div>
        ) : null}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs leading-relaxed text-muted">
            <p>© {year} AgendaPix{pending ? " · [razão social / CNPJ, se houver]" : null}</p>
            <p className="mt-1">Pagamentos Pix processados pelo Mercado Pago</p>
          </div>
          <ThemeToggle variant="text" />
        </div>
      </div>
    </footer>
  );
}
