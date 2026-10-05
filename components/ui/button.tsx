import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-feedback focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper shadow-[var(--shadow-card)] hover:bg-ink-hover active:scale-[0.985]",
        pix: "bg-pix text-pix-foreground shadow-[var(--shadow-card)] hover:bg-pix-hover active:scale-[0.985]",
        outline: "border border-line bg-surface text-ink hover:border-line-strong hover:bg-subtle",
        ghost: "text-ink hover:bg-subtle",
        danger: "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
        /** @deprecated use `default` */
        dark: "bg-slab text-slab-foreground hover:bg-ink-hover",
      },
      size: {
        default: "",
        lg: "min-h-12 px-6 text-base",
        sm: "min-h-10 px-4 text-sm",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
