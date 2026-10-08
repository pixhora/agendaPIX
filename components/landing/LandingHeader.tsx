"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLink } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setLandingNavOpen } from "./nav-state";

const links = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#exemplo", label: "Exemplo", menuLabel: "Página de exemplo" },
  { href: "#precos", label: "Preços" },
  { href: "#perguntas-frequentes", label: "Dúvidas" },
] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }

  useEffect(() => {
    setLandingNavOpen(open);
    return () => setLandingNavOpen(false);
  }, [open]);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 8;
      setScrolled((current) => (current === next ? current : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia("(min-width: 768px)");
    const closeIfWide = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", closeIfWide);
    return () => media.removeEventListener("change", closeIfWide);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = dialogRef.current?.querySelector<HTMLElement>("a[href]");
    first?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const focusable = [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <header className={cn("sticky top-0 z-40 bg-paper/85 backdrop-blur-[10px]", scrolled && "border-b border-line")}>
      <div className="mx-auto flex h-[60px] max-w-[1120px] items-center justify-between gap-2 px-5 lg:h-[72px]">
        <BrandLink />
        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted transition-feedback hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/login" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink hover:bg-subtle md:inline-flex">
            Entrar
          </Link>
          <Link href="/onboarding" className={cn(buttonVariants({ size: "sm", className: "hidden min-h-11 md:inline-flex" }))}>
            Criar agenda grátis
          </Link>
          <Link href="/onboarding" className={cn(buttonVariants({ size: "sm", className: "min-h-11 whitespace-nowrap px-3.5 md:hidden" }))}>
            Criar grátis
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-subtle md:hidden"
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => (open ? close(false) : setOpen(true))}
          >
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" tabIndex={-1} className="absolute inset-0 bg-ink/40" aria-label="Fechar menu" onClick={() => close(true)} />
          <div
            ref={dialogRef}
            id="landing-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={onDialogKeyDown}
            className="absolute inset-x-0 top-[60px] border-b border-line bg-paper px-5 pt-2 pb-5 shadow-[var(--shadow-raised)]"
          >
            <p id={titleId} className="sr-only">Menu</p>
            <nav aria-label="Seções" className="flex flex-col">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-12 items-center text-base font-semibold text-ink"
                  onClick={() => close(false)}
                >
                  {"menuLabel" in link ? link.menuLabel : link.label}
                </a>
              ))}
            </nav>
            <div className="my-3 h-px bg-line" />
            <Link href="/login" className="inline-flex min-h-12 items-center text-base font-semibold text-ink" onClick={() => close(false)}>
              Entrar
            </Link>
            <Link href="/onboarding" className={cn(buttonVariants({ size: "lg", className: "mt-2 w-full" }))} onClick={() => close(false)}>
              Criar minha agenda grátis
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
