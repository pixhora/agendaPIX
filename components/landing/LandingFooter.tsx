import { BrandMark } from "@/components/ui/brand-mark";
import { legalPagesPublished, showPendingBlocks } from "@/lib/marketing/flags";
import { cn } from "@/lib/utils";
import { belowFold } from "./section";

const focusRing = "outline-none [outline:none!important] focus-visible:shadow-[var(--shadow-focus)]";

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
    <footer id="rodape" className={cn("border-t border-line bg-surface", belowFold)}>
      <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <a href="/" aria-label="AgendaPix, página inicial" className="inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-field text-ink">
            <BrandMark />
            <span className="relative -top-0.5 font-display text-lg leading-none tracking-[-0.02em]">
              <span className="font-bold">Agenda</span>
              <span className="font-extrabold text-pix">Pix</span>
            </span>
          </a>
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
          <a href="/login" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">Entrar</a>
          <a href="/onboarding" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">Criar agenda grátis</a>
        </nav>
        {legal ? (
          <nav aria-label="Legal" className="flex flex-col">
            <p className="text-sm font-semibold text-ink">Legal</p>
            <a href="/termos" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">Termos de uso</a>
            <a href="/privacidade" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink">Política de privacidade</a>
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
          <div className="flex flex-wrap items-center gap-2">
            <span id="tema-rotulo" className="text-sm text-muted">Tema</span>
            <div role="radiogroup" aria-labelledby="tema-rotulo" className="inline-flex items-center rounded-full border border-line bg-surface p-0.5">
              <button type="button" role="radio" data-theme="light" aria-checked="false" aria-label="Tema claro" title="Tema claro" className={cn("inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-muted transition-feedback hover:text-ink", focusRing)}>
                Claro
              </button>
              <button type="button" role="radio" data-theme="dark" aria-checked="false" aria-label="Tema escuro" title="Tema escuro" className={cn("inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-muted transition-feedback hover:text-ink", focusRing)}>
                Escuro
              </button>
              <button type="button" role="radio" data-theme="system" aria-checked="true" aria-label="Seguir o sistema" title="Seguir o sistema" className={cn("inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-3 text-sm font-semibold text-paper transition-feedback hover:text-paper", focusRing)}>
                Sistema
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
