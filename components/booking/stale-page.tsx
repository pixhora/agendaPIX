"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { STALE_PAGE_BODY, STALE_PAGE_RELOAD, STALE_PAGE_TITLE } from "./customer-copy";

/** Página pública desatualizada. O botão recarrega para gerar outra Idempotency-Key. */
export function StalePageNotice() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section role="alert" data-testid="stale-page" className="rounded-frame bg-surface px-6 py-8 text-center shadow-[var(--shadow-card)]">
      <h1 ref={titleRef} tabIndex={-1} className="mx-auto max-w-[28ch] font-display text-xl font-extrabold tracking-tight text-ink outline-none sm:text-2xl">
        {STALE_PAGE_TITLE}
      </h1>
      <p className="mx-auto mt-3 max-w-[40ch] text-sm leading-relaxed text-muted">{STALE_PAGE_BODY}</p>
      <Button type="button" variant="pixDeep" size="lg" className="mt-6 w-full" onClick={() => window.location.reload()}>
        {STALE_PAGE_RELOAD}
      </Button>
    </section>
  );
}
