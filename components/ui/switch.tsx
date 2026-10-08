import * as React from "react";
import { cn } from "@/lib/utils";

/** Checkbox nativo com aparência de switch (mantém semântica, teclado e envio em formulário). */
export function Switch({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <span className="inline-flex rounded-full focus-within:shadow-focus">
      <input
        type="checkbox"
        className={cn(
          "relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong transition-feedback outline-none",
          "before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform before:content-['']",
          "checked:bg-pix checked:before:translate-x-4 disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-100",
          className,
        )}
        {...props}
      />
    </span>
  );
}
