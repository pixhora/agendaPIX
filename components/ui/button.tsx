import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs active:scale-[0.99]",
        outline: "border border-border bg-surface text-foreground hover:bg-muted font-medium",
        dark: "bg-dark-card text-white hover:bg-black font-bold shadow-sm",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" className={cn(buttonVariants({ variant, className }))} {...props} />;
}

export { Button, buttonVariants };
