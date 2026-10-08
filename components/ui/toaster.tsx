"use client";

import { Toaster as Sonner } from "sonner";

/** Toasts (Sonner) com os tokens do app. O feedback inline / aria-live continua sendo a fonte principal. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-card! border! border-line! bg-surface! text-ink! shadow-[var(--shadow-raised)]! font-sans!",
          description: "text-muted!",
          closeButton: "bg-surface! border-line! text-ink!",
        },
      }}
    />
  );
}
