"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn("fixed inset-0 z-50 bg-ink/40", className)} {...props} />;
}

/** Sheet de baixo para cima. O Dialog do Radix prende o foco, fecha no Esc e no toque fora, e devolve o foco ao gatilho. */
function DialogSheetContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-modal="true"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-frame border border-line bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-ink shadow-[var(--shadow-raised)] outline-none motion-safe:animate-step-in",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogDescription, DialogSheetContent, DialogTitle, DialogTrigger };
