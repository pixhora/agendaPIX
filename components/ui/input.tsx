import * as React from "react";
import { cn } from "@/lib/utils";

/** Campo de texto ≥48px e fonte 16px (evita zoom no iOS). */
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-12 w-full min-w-0 rounded-field border border-line-strong/60 bg-surface px-3.5 text-base text-ink transition-feedback placeholder:text-muted/80",
        "hover:border-line-strong focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "min-h-12 w-full min-w-0 rounded-field border border-line-strong/60 bg-surface px-3 text-base text-ink transition-feedback hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Select };
