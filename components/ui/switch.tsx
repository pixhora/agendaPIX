import * as React from "react";
import { cn } from "@/lib/utils";

/** Checkbox nativo com aparência de switch (mantém semântica, teclado e envio em formulário). */
export function Switch({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong transition-feedback",
        "before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform before:content-['']",
        "checked:bg-pix checked:before:translate-x-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
