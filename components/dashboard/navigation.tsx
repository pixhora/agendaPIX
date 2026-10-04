"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import styles from "./motion.module.css";

export function DashboardNavigation({ children, current }: { children: ReactNode; current: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className={styles.scope}>
    <div ref={root} className={`${styles.mobile} sm:hidden`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === "Escape" && open) { setOpen(false); trigger.current?.focus(); }
    }}>
      <Button ref={trigger} variant="outline" className="w-full justify-between" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span>Painel · {current}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
      </Button>
      <nav id={id} aria-label="Painel" inert={!open} data-open={open} className={`${styles.panel} grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-2 shadow-lg`} onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) { setOpen(false); trigger.current?.focus(); }
      }}>{children}</nav>
    </div>
    <nav aria-label="Painel" className="hidden w-fit gap-2 rounded-xl border border-border bg-muted p-2 sm:flex">{children}</nav>
  </div>;
}
