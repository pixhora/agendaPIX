"use client";

import { Clock3, Eye, Lock } from "lucide-react";
import type { OnboardingData } from "./types";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";
import { usePublicHost } from "./parts";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function describeDays(days: number[]) {
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((day) => days.includes(day));
  if (!ordered.length) return "Nenhum dia";
  return ordered.map((day) => DAY_LABELS[day]).join(", ");
}

/** Prévia ao vivo da página pública enquanto o dono preenche o cadastro (só no desktop). */
export function OnboardingPreview({ data }: { data: OnboardingData }) {
  const host = usePublicHost();
  const name = data.businessName.trim() || "Seu negócio";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  return (
    <aside aria-label="Prévia da sua página" className="hidden lg:sticky lg:top-10 lg:block">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted"><Eye aria-hidden="true" className="size-4" />Prévia da sua página</p>
      <div className="overflow-hidden rounded-frame border border-line bg-surface shadow-[var(--shadow-raised)]">
        <div className="flex items-center gap-2 border-b border-line bg-subtle/70 px-4 py-2.5 text-xs text-muted">
          <Lock aria-hidden="true" className="size-3" />
          <span className="truncate">{host}/<strong className="text-ink">{data.slug || "seu-negocio"}</strong></span>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-2xl bg-ink font-display text-sm font-extrabold text-paper">{initials || "A"}</span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold">{name}</p>
              <p className="text-xs text-muted">Agende online · sinal via Pix</p>
            </div>
          </div>
          <div className="rounded-card border-2 border-ink p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{data.serviceName.trim() || "Seu serviço"}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Clock3 aria-hidden="true" className="size-3" />{formatDuration(data.durationMinutes)}</p>
              </div>
              <p className="font-display font-bold tabular-nums">{formatCurrency(data.priceCents)}</p>
            </div>
            {data.depositCents > 0 && <p className="mt-3 inline-flex min-h-6 items-center rounded-full bg-pix-soft px-2.5 text-xs font-semibold text-pix">Sinal Pix {formatCurrency(data.depositCents)}</p>}
          </div>
          <div className="rounded-field bg-subtle/70 px-3 py-2.5 text-xs">
            <p className="font-semibold">Atendimento</p>
            <p className="mt-0.5 text-muted">{describeDays(data.openDays)} · <span className="tabular-nums">{data.opensAt}–{data.closesAt}</span></p>
          </div>
          <div aria-hidden="true" className="flex min-h-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">Escolher horário</div>
        </div>
      </div>
    </aside>
  );
}
