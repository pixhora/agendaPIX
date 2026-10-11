"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDuration } from "@/components/booking/formatters";
import { publicAvailabilityUrl } from "@/lib/public-api";
import { isOfflineError, readApiErrorCode } from "@/components/booking/booking-error";
import {
  LINK_COPIED,
  MESSAGE_COPIED,
  OWNER_HOLD_HINT,
  OWNER_MP,
  OWNER_NETWORK,
  OWNER_NO_DEPOSIT,
  OWNER_NO_SLOTS,
  OWNER_SLOT_TAKEN,
  SLOT_LINK_STATUS_LABEL,
  addDays,
  clockInZone,
  isoDateInZone,
  ownerSummary,
  slotLinkMessage,
  validityLine,
  weekdayShort,
  formatDayMonth,
} from "@/lib/slot-link/copy";
import { parseCreatedLink } from "@/lib/slot-link/owner-link";
import { ownerSlotLinksUrl, slotLinkPagePath } from "@/lib/slot-link/paths";
import { sendOnWhatsApp } from "@/lib/slot-link/share";
import type { DepositService, SlotSeed } from "./types";

type SlotOption = { time: string; startsAt: string };

function toIso(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export function SlotLinkSheet({
  onClose,
  businessId,
  slug,
  timezone,
  today,
  services,
  mpReady,
  seed,
  onCreated,
}: {
  onClose: () => void;
  businessId: string;
  slug: string;
  timezone: string;
  today: string;
  services: DepositService[];
  mpReady: boolean;
  seed: SlotSeed | null;
  onCreated: (created: { id: string; url: string }) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [serviceId, setServiceId] = useState(seed?.serviceId ?? "");
  const [date, setDate] = useState(seed?.date ?? "");
  const [time, setTime] = useState(seed?.time ?? "");
  const [customerLabel, setCustomerLabel] = useState("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [slotsState, setSlotsState] = useState<"idle" | "loading" | "ready" | "error">(seed?.serviceId ? "loading" : "idle");
  const [showCalendar, setShowCalendar] = useState(false);
  const [slotsReload, setSlotsReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ url: string; message: string; expiresAt: string; statusLabel: string } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (!serviceId) return;
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    let cancelled = false;
    const controller = new AbortController();
    const horizon = Array.from({ length: 14 }, (_, index) => addDays(today, index));
    const windows = [horizon.slice(0, 7), horizon.slice(7)];
    void Promise.all(windows.map(async (days) => {
      const anchor = days[0];
      if (!anchor) return [] as { date: string; slots: { startsAt: string }[] }[];
      const response = await fetch(publicAvailabilityUrl(slug, service.id, anchor, days), { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("slots");
      const body = await response.json() as { slots?: { startsAt: string }[]; days?: { date: string; slots?: { startsAt: string }[] }[] };
      if (Array.isArray(body.days) && body.days.length > 0) return body.days.map((day) => ({ date: day.date, slots: day.slots ?? [] }));
      return [{ date: anchor, slots: body.slots ?? [] }];
    }))
      .then((groups) => {
        if (cancelled) return;
        const byDate = new Map<string, SlotOption[]>();
        for (const day of groups.flat()) {
          const options = day.slots.map((slot) => ({ startsAt: slot.startsAt, time: clockInZone(slot.startsAt, timezone) }));
          byDate.set(day.date, options);
        }
        const enabled = new Set([...byDate.entries()].filter(([, options]) => options.length > 0).map(([day]) => day));
        setOpenDates(enabled);
        setSlots(date ? byDate.get(date) ?? [] : []);
        setSlotsState("ready");
        setTime((current) => (date && current && !(byDate.get(date) ?? []).some((slot) => slot.time === current) ? "" : current));
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof Error && error.name === "AbortError")) return;
        setSlotsState("error");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [serviceId, slug, today, timezone, services, date, slotsReload]);

  const service = services.find((item) => item.id === serviceId) ?? null;
  const summary = service && date && time ? ownerSummary({ serviceName: service.name, date, time, depositCents: service.depositCents }) : null;
  const selected = useMemo(() => (date ? new Date(`${date}T12:00:00`) : undefined), [date]);

  async function generate() {
    if (!service || !date || !time || !mpReady) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(ownerSlotLinksUrl(businessId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          date,
          time,
          ...(customerLabel.trim() ? { customerLabel: customerLabel.trim() } : {}),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = readApiErrorCode(body);
        if (code === "slot_unavailable") {
          setError(OWNER_SLOT_TAKEN);
          setTime("");
          setSlotsReload((current) => current + 1);
        } else if (code === "mp_not_connected") setError(OWNER_MP);
        else setError(OWNER_NETWORK);
        return;
      }
      const created = parseCreatedLink(body);
      const origin = window.location.origin;
      const url = `${origin}${slotLinkPagePath(slug, created.token)}`;
      const message = slotLinkMessage({
        customerLabel,
        serviceName: created.service.name,
        date: isoDateInZone(created.startsAt, timezone),
        time: clockInZone(created.startsAt, timezone),
        depositCents: created.service.depositCents,
        url,
      });
      setReady({ url, message, expiresAt: created.expiresAt, statusLabel: SLOT_LINK_STATUS_LABEL[created.status] });
      onCreated({ id: created.id, url });
    } catch (caught) {
      setError(isOfflineError(caught) ? OWNER_NETWORK : OWNER_NETWORK);
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="slot-link-sheet-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
      className="fixed inset-x-0 bottom-0 top-auto z-40 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-frame border-0 bg-surface p-0 text-ink shadow-[var(--shadow-raised)] backdrop:bg-black/45 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-dvh sm:w-[28rem] sm:rounded-none sm:rounded-l-frame"
    >
      <div className="grid gap-5 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="slot-link-sheet-title" className="font-display text-2xl font-extrabold tracking-tight">{ready ? "Link pronto" : "Mandar um horário"}</h2>
          <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>Fechar</Button>
        </div>
        {services.length === 0 ? (
          <div className="grid gap-3">
            <p className="text-sm text-ink">{OWNER_NO_DEPOSIT}</p>
            <Link className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4" href={`/dashboard/services?businessId=${businessId}`}>Configurar serviços</Link>
          </div>
        ) : null}
        {services.length > 0 && !ready ? (
          <div className="grid gap-4">
            {!mpReady ? (
              <p className="rounded-card border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
                {OWNER_MP}{" "}
                <Link className="font-semibold underline underline-offset-4" href={`/dashboard/settings?businessId=${businessId}`}>Configurações</Link>
              </p>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="slot-link-service">Serviço</Label>
              <Select id="slot-link-service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setTime(""); }}>
                <option value="">Escolha o serviço</option>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {formatDuration(item.durationMinutes)} · {formatCurrency(item.priceCents)} · sinal {formatCurrency(item.depositCents)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold text-ink" id="slot-link-date-label">Data</span>
              <Button type="button" variant="outline" className="justify-start" aria-labelledby="slot-link-date-label" disabled={!serviceId} onClick={() => setShowCalendar((current) => !current)}>
                {date ? `${weekdayShort(date)}, ${formatDayMonth(date)}` : "Escolha a data"}
              </Button>
              {showCalendar ? (
                <Calendar
                  mode="single"
                  selected={selected}
                  defaultMonth={selected ?? new Date(`${today}T12:00:00`)}
                  disabled={(value) => !openDates.has(toIso(value))}
                  onSelect={(value) => {
                    if (!value) return;
                    const next = toIso(value);
                    if (!openDates.has(next)) return;
                    setDate(next);
                    setTime("");
                    setShowCalendar(false);
                  }}
                />
              ) : null}
            </div>
            {serviceId && date ? (
              <div className="grid gap-2">
                <p id="slot-link-time-label" className="text-sm font-semibold text-ink">Horário</p>
                <div role="radiogroup" aria-labelledby="slot-link-time-label" aria-live="polite" className="flex flex-wrap gap-2">
                  {slotsState === "loading" ? <p className="text-sm text-muted">Carregando horários…</p> : null}
                  {slotsState === "error" ? <p className="text-sm text-danger">{OWNER_NETWORK}</p> : null}
                  {slotsState === "ready" && slots.length === 0 ? <p className="text-sm text-muted">{OWNER_NO_SLOTS}</p> : null}
                  {slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      role="radio"
                      aria-checked={time === slot.time}
                      onClick={() => setTime(slot.time)}
                      className={time === slot.time
                        ? "inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-paper"
                        : "inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink"}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="slot-link-customer">Nome da cliente (para você lembrar)</Label>
              <Input id="slot-link-customer" value={customerLabel} autoComplete="off" maxLength={80} onChange={(event) => setCustomerLabel(event.target.value)} />
            </div>
            {summary ? <p className="text-sm font-semibold text-ink">{summary}</p> : null}
            <p className="text-sm text-muted">{OWNER_HOLD_HINT}</p>
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <Button type="button" variant="pix" size="lg" disabled={!summary || submitting || !mpReady} onClick={() => void generate()}>
              {submitting ? "Gerando…" : "Gerar link"}
            </Button>
          </div>
        ) : null}
        {ready ? (
          <div className="grid gap-4" data-testid="slot-link-ready">
            <p aria-live="polite" className="text-sm font-semibold text-ink">{ready.statusLabel}</p>
            <Label htmlFor="slot-link-message">Mensagem</Label>
            <textarea
              id="slot-link-message"
              className="min-h-36 w-full rounded-card border border-line bg-surface p-3 text-base text-ink"
              value={ready.message}
              onChange={(event) => setReady({ ...ready, message: event.target.value })}
            />
            <p className="text-sm text-muted">{validityLine(ready.expiresAt, timezone)}</p>
            <Button
              type="button"
              variant="pix"
              size="lg"
              onClick={() => void sendOnWhatsApp(ready.message, {
                mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
                share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
                open: (url) => window.open(url, "_blank", "noopener,noreferrer"),
              })}
            >
              Enviar no WhatsApp
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => void copy(ready.url, LINK_COPIED)}>Copiar link</Button>
              <Button type="button" variant="outline" onClick={() => void copy(ready.message, MESSAGE_COPIED)}>Copiar mensagem</Button>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
