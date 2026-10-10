import { BrandMark } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { landingNavLinks } from "./nav-links";

const focusRing = "outline-none [outline:none!important] focus-visible:shadow-[var(--shadow-focus)]";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 bg-paper/85 backdrop-blur-[10px]">
      <div className="mx-auto flex h-[60px] max-w-[1120px] items-center justify-between gap-2 px-5 lg:h-[72px]">
        <a href="/" aria-label="AgendaPix, página inicial" className="inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-field text-ink">
          <BrandMark />
          <span className="relative -top-0.5 font-display text-lg leading-none tracking-[-0.02em]">
            <span className="font-bold">Agenda</span>
            <span className="font-extrabold text-pix">Pix</span>
          </span>
        </a>
        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {landingNavLinks.map((link) => (
            <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted transition-feedback hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <a href="/login" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink hover:bg-subtle md:inline-flex">
            Entrar
          </a>
          <a href="/onboarding" className={cn(buttonVariants({ size: "sm", className: "hidden min-h-11 md:inline-flex" }))}>
            Criar agenda grátis
          </a>
          <a href="/onboarding" className={cn(buttonVariants({ size: "sm", className: "min-h-11 whitespace-nowrap px-3.5 md:hidden" }))}>
            Criar grátis
          </a>
          <button
            id="landing-menu-button"
            type="button"
            className={cn("inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-subtle md:hidden", focusRing)}
            aria-expanded="false"
            aria-controls="landing-menu"
            aria-label="Abrir menu"
          >
            <span data-icon="open" className="inline-flex">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
                <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span data-icon="close" hidden className="inline-flex">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
                <path d="M5 5 15 15M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </button>
        </div>
      </div>
      <template
        id="landing-menu-source"
        dangerouslySetInnerHTML={{
          __html: `<div id="landing-menu-layer" class="md:hidden"><button id="landing-menu-overlay" type="button" tabindex="-1" aria-hidden="true" class="fixed inset-0 z-40 bg-black/40"></button><div id="landing-menu" role="dialog" aria-modal="true" aria-labelledby="landing-menu-title" class="fixed inset-x-0 top-[60px] z-50 border-b border-line bg-paper px-5 pt-2 pb-5 font-display shadow-[var(--shadow-raised)]"><p id="landing-menu-title" class="sr-only">Menu</p><nav aria-label="Seções" class="flex flex-col">${landingNavLinks
            .map((link) => {
              const label = "menuLabel" in link ? link.menuLabel : link.label;
              return `<a href="${link.href}" class="${cn("inline-flex min-h-12 items-center rounded-lg px-2 text-base font-semibold text-ink", focusRing)}">${label}</a>`;
            })
            .join("")}</nav><div class="my-3 h-px bg-line"></div><a href="/login" class="${cn("inline-flex min-h-12 items-center rounded-lg px-2 text-base font-semibold text-ink", focusRing)}">Entrar</a><a href="/onboarding" class="${cn(buttonVariants({ size: "lg", className: "mt-2 w-full" }))}">Criar minha agenda grátis</a></div></div>`,
        }}
      ></template>
    </header>
  );
}
