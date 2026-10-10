"use client";

import { useEffect, useState } from "react";
import { formatCents } from "@/lib/money";
import { normalizeSlug } from "@/lib/slug";
import { STORE_WEEKDAYS, storeInitials } from "@/lib/store-profile/model";
import type { OnboardingData } from "@/components/onboarding/types";
import { cn } from "@/lib/utils";

function dash(value: string) {
  return <span className="text-muted-foreground">{value}</span>;
}

export function storePreviewSummary(data: OnboardingData, prefix: string): string {
  const name = data.businessName.trim() ? data.businessName.trim() : "nome não preenchido";
  const slug = normalizeSlug(data.slug, { final: true });
  const link = slug ? `link ${prefix ? `${prefix}/` : ""}${slug}` : "link não preenchido";
  const service = data.serviceName.trim() ? data.serviceName.trim() : "serviço não preenchido";
  return `Prévia: ${name}, ${link}, ${service}.`;
}

function serviceLine(data: OnboardingData) {
  const name = data.serviceName.trim() || "—";
  const duration = data.durationMinutes > 0 ? `${data.durationMinutes} min` : "— min";
  const price = data.priceCents > 0 ? `R$ ${formatCents(data.priceCents)}` : "R$ —";
  return `${name} · ${duration} · ${price}`;
}

function hoursLine(data: OnboardingData) {
  const days = data.days ?? [];
  const open = STORE_WEEKDAYS.flatMap((meta) => {
    const day = days.find((item) => item.weekday === meta.weekday);
    if (!day?.open || !day.opensAt || !day.closesAt) return [];
    return [`${meta.label} ${day.opensAt}–${day.closesAt}`];
  });
  if (!open.length) return "Horários: —";
  return `Horários: ${open.join(", ")}`;
}

function Card({ data, prefix, logoUrl }: { data: OnboardingData; prefix: string; logoUrl: string | null }) {
  const name = data.businessName.trim();
  const initials = storeInitials(name);
  const slug = normalizeSlug(data.slug, { final: true });
  const depositOn = (data.depositMode ?? "none") !== "none";
  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-surface p-4">
      <span className="absolute top-3 right-3 rounded-full bg-ink px-2 py-1 text-xs font-semibold text-paper">Prévia</span>
      <div aria-hidden="true" className="grid gap-3 pt-6">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo enviada ou prévia local
            <img src={logoUrl} alt="" className="size-16 rounded-full object-cover" />
          ) : initials ? (
            <span className="grid size-16 place-items-center rounded-full bg-subtle text-lg font-bold">{initials}</span>
          ) : (
            <span className="grid size-16 place-items-center rounded-full bg-subtle text-muted-foreground">—</span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold">{name ? name : dash("—")}</p>
            <p className="truncate text-sm text-muted-foreground">{prefix ? `${prefix}/` : ""}{slug || "—"}</p>
          </div>
        </div>
        <p className={cn("text-sm", !data.serviceName.trim() && "text-muted-foreground")}>{serviceLine(data)}</p>
        {depositOn ? (
          <p className="text-sm">Sinal no Pix: {data.depositCents > 0 ? `R$ ${formatCents(data.depositCents)}` : dash("R$ —")}</p>
        ) : null}
        <p className={cn("text-sm", hoursLine(data) === "Horários: —" && "text-muted-foreground")}>{hoursLine(data)}</p>
        <span className="pointer-events-none flex min-h-11 items-center justify-center rounded-full bg-subtle text-sm font-semibold text-muted-foreground">Agendar</span>
      </div>
    </div>
  );
}

export function StorePreview({ data, prefix, logoUrl }: { data: OnboardingData; prefix: string; logoUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const previewLogo = logoUrl ?? data.logoUrl ?? null;
  const summary = storePreviewSummary(data, prefix);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="fixed right-4 bottom-24 z-30 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold shadow-[var(--shadow-card)] lg:hidden"
        onClick={() => setOpen(true)}
      >
        Ver prévia
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Prévia" className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Fechar prévia" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-auto rounded-t-3xl bg-surface p-4">
            <Card data={data} prefix={prefix} logoUrl={previewLogo} />
            <p className="sr-only">{summary}</p>
            <button type="button" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border font-semibold" onClick={() => setOpen(false)}>Fechar</button>
          </div>
        </div>
      ) : null}
      <aside className="hidden lg:sticky lg:top-10 lg:block" aria-label="Prévia">
        <p className="mb-3 text-sm text-muted-foreground">Prévia — atualiza enquanto você digita</p>
        <Card data={data} prefix={prefix} logoUrl={previewLogo} />
        <p className="sr-only">{summary}</p>
      </aside>
    </>
  );
}
