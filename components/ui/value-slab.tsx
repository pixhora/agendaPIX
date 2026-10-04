import * as React from "react";
import { cn } from "@/lib/utils";

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
        "rounded-[24px] sm:rounded-[32px] border border-line bg-slab text-slab-foreground p-6 sm:p-7 shadow-md relative overflow-hidden transition-all",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/80 text-[#A3A3A8]">
          {label}
        </span>
        {badge}
      </div>

      <div className="my-1">
        <div className="font-display font-black tracking-tight tabular-nums text-4xl sm:text-6xl text-white">
          {value}
        </div>
      </div>

      {sublabel && (
        <div className="mt-2 text-xs text-[#A3A3A8] font-medium flex items-center gap-1.5">
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors",
        active
          ? "border-line bg-surface text-foreground"
          : "border-line bg-muted/20 text-muted-foreground",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          active ? "bg-lime" : "bg-muted-foreground/40"
        )}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
