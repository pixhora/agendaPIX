"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { fieldShell } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Único select do app. A lista escala a partir do campo (sem deslize).
 * A seta fica a 12px da borda e gira 180° ao abrir.
 */
function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        fieldShell,
        "relative justify-between gap-2 pr-10 pl-3.5 text-left text-base text-ink outline-none",
        "data-[placeholder]:text-muted",
        "disabled:cursor-not-allowed disabled:border-line disabled:bg-subtle disabled:text-muted disabled:shadow-none",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <ChevronDown data-slot="select-icon" className="size-4 text-muted" strokeWidth={2} />
        </span>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ placeholder, ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      placeholder={placeholder}
      className="min-w-0 flex-1 truncate"
      {...props}
    />
  );
}

function SelectContent({ className, children, position = "popper", sideOffset = 4, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-field border border-line bg-surface text-ink shadow-[var(--shadow-raised)]",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center rounded-[10px] py-2 pr-10 pl-3 text-base text-ink outline-none select-none",
        "data-[disabled]:pointer-events-none data-[disabled]:text-muted",
        "data-[highlighted]:bg-subtle",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span aria-hidden="true" className="absolute inset-y-0 right-3 flex items-center">
        <SelectPrimitive.ItemIndicator>
          <Check data-slot="select-item-indicator" className="size-4 text-ink" strokeWidth={2.5} />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
