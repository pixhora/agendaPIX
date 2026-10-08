"use client";

import { Clock, ShieldCheck } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface PolicySummaryLineProps {
  summary: string;
  tone?: "ok" | "warn";
  /** Passo Pix: uma linha menor, sem card. */
  compact?: boolean;
  onDetails: (trigger: HTMLElement) => void;
}

/** Linha da política. O texto é o `policySummary` do servidor. */
export function PolicySummaryLine({ summary, tone = "ok", compact = false, onDetails }: PolicySummaryLineProps) {
  const warn = tone === "warn";
  const details = (
    <button
      type="button"
      className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-line-strong underline-offset-4"
      onClick={(event) => onDetails(event.currentTarget)}
    >
      Ver detalhes
    </button>
  );

  if (compact) {
    return (
      <p data-testid="policy-summary" className="text-[13px] leading-relaxed text-muted">
        <span>{summary}</span>
        <span aria-hidden="true"> · </span>
        {details}
      </p>
    );
  }

  return (
    <div
      data-testid="policy-summary"
      className={cn(
        "flex items-start gap-3 rounded-card border border-line px-4 py-3",
        warn ? "bg-warning-soft" : "bg-surface",
      )}
    >
      <Icon icon={warn ? Clock : ShieldCheck} className={cn("mt-0.5 size-[18px]", warn ? "text-warning" : "text-pix")} />
      <p className="min-w-0 text-sm leading-snug text-ink">
        <span>{summary}</span>{" "}
        {details}
      </p>
    </div>
  );
}
