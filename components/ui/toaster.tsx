"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toasts (Sonner) com os tokens do app. O feedback inline / aria-live continua sendo a fonte principal.
 * O recuo da barra fixa vale só embaixo: no celular o Sonner desconta a margem esquerda duas vezes da largura.
 */
const toastOffset = {
  top: 16,
  right: 16,
  bottom: "calc(16px + var(--sticky-cta-height, 0px))",
  left: 16,
} as const;

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={toastOffset}
      mobileOffset={toastOffset}
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-card !border !border-line !bg-surface !text-ink !shadow-[var(--shadow-raised)] !font-sans",
          description: "!text-muted",
          closeButton: "!bg-surface !border-line !text-ink",
        },
      }}
    />
  );
}
