"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PREVIEW_LINKS = [
  { href: "/preview", label: "Hub" },
  { href: "/preview/landing", label: "Landing" },
  { href: "/preview/booking", label: "Booking" },
  { href: "/preview/dashboard", label: "Dashboard" },
  { href: "/preview/reservas", label: "Reservas" },
  { href: "/preview/servicos", label: "Serviços" },
  { href: "/preview/configuracoes", label: "Configurações" },
];

export function PreviewBadge() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={menuRef}
        aria-label="Controles do Modo Preview"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-40 flex flex-col items-start gap-2 font-sans"
      >
        {/* Menu Expandido de Navegação do Preview */}
        {isOpen && (
          <div className="w-56 rounded-xl border border-border bg-surface/95 p-2 shadow-xl backdrop-blur-md text-xs animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between border-b border-border pb-1.5 px-2 mb-1">
              <span className="font-semibold text-foreground">Modo Preview</span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                Dev
              </span>
            </div>

            <nav className="flex flex-col gap-0.5">
              {PREVIEW_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-subtle hover:text-foreground"
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive && <span className="text-[10px]">●</span>}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-2 border-t border-border pt-1.5 px-2 text-[10px] text-muted-foreground text-center">
              Studio Bella · São Paulo SP
            </div>
          </div>
        )}

        {/* Pílula Discreta e Elegante com alvo mínimo de 44px */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface/95 px-2.5 text-[11px] font-semibold text-foreground shadow-md backdrop-blur hover:bg-surface focus-visible:outline-none focus-visible:shadow-focus cursor-pointer"
        >
          <span className="size-1.5 rounded-full bg-success" />
          <span>Preview</span>
          <span className="text-muted-foreground text-[10px]">
            {isOpen ? "✕" : "▾"}
          </span>
        </button>
      </aside>
    </>
  );
}
