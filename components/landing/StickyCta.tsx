"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { buttonVariants } from "@/components/ui/button";

const subscribeNothing = () => () => {};

/**
 * Barra fixa do celular. Só monta depois da hidratação e vai para o body por portal:
 * assim o HTML do servidor não tem o nó e o React não precisa recriar a página.
 */
export function StickyCta() {
  // false no servidor e na hidratação; true depois que o cliente monta.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div
      id="sticky-cta"
      data-visible="false"
      role="region"
      aria-label="Criar agenda"
      aria-hidden="true"
      inert
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 translate-y-full border-t border-line bg-paper/92 px-4 pt-3 font-display backdrop-blur-[8px] md:hidden pb-[calc(12px+env(safe-area-inset-bottom))] transition-transform duration-[180ms] ease-[var(--ease-standard)] motion-reduce:transition-none"
    >
      <a href="/onboarding" className={buttonVariants({ size: "lg", className: "w-full" })}>
        Criar minha agenda grátis
      </a>
      <p className="mt-1.5 text-center text-[12px] text-muted">7 dias grátis · sem cartão</p>
    </div>,
    document.body,
  );
}
