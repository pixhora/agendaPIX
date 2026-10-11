import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const fieldShell =
  "flex min-h-12 w-full min-w-0 items-center rounded-field border border-line-strong/60 bg-surface transition-feedback focus-within:border-ring focus-within:shadow-focus has-[[aria-invalid=true]]:border-danger has-[:disabled]:border-line has-[:disabled]:bg-subtle has-[:disabled]:shadow-none";

export const fieldControl =
  "h-12 w-full min-w-0 bg-transparent px-3.5 text-base text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted";

/** Campo de texto ≥48px e fonte 16px (evita zoom no iOS). O anel fica no invólucro. */
function Input({ className, shellClassName, type = "text", ...props }: React.ComponentProps<"input"> & { shellClassName?: string }) {
  return (
    <div className={cn(fieldShell, shellClassName)}>
      <input
        type={type}
        data-slot="input"
        className={cn(fieldControl, className)}
        {...props}
      />
    </div>
  );
}

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn(fieldShell, "relative")}>
      <select
        data-slot="select"
        className={cn(fieldControl, "appearance-none bg-none py-0 pr-10 pl-3", className)}
        {...props}
      />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export { Input, Select };
