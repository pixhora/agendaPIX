import * as React from "react";
import { cn } from "../../lib/utils";

interface ValueSlabProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  sublabel?: string;
  badge?: React.ReactNode;
}

export function ValueSlab({
  label,
  value,
  sublabel,
  badge,
  className,
  ...props
}: ValueSlabProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-line bg-slab p-6 text-slab-foreground sm:rounded-frame sm:p-7",
        className
      )}
      {...props}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slab-foreground/70">
          {label}
        </span>
        {badge}
      </div>

      <div className="my-1">
        <div className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-slab-foreground sm:text-6xl">
          {value}
        </div>
      </div>

      {sublabel && (
        <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slab-foreground/70">
          {sublabel}
        </div>
      )}
    </div>
  );
}

interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  active?: boolean;
}

export function StatusChip({
  children,
  active = false,
  className,
  ...props
}: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs font-semibold text-ink",
        active
          ? ""
          : "text-muted",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          active ? "bg-lime" : "bg-muted"
        )}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
