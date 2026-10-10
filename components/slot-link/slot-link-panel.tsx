"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { publicAvailabilityUrl } from "@/lib/public-api";
import { OWNER_NO_DEPOSIT, clockInZone } from "@/lib/slot-link/copy";
import { SentLinks } from "./sent-links";
import { SlotLinkSheet } from "./slot-link-sheet";
import type { DepositService, SlotSeed } from "./types";

type ListedSlot = SlotSeed & { label: string };
type FreeSlot = ListedSlot & { requestKey: string };

export function SlotLinkPanel({
  businessId,
  slug,
  timezone,
  date,
  today,
  services,
  mpReady,
}: {
  businessId: string;
  slug: string;
  timezone: string;
  date: string;
  today: string;
  services: DepositService[];
  mpReady: boolean;
}) {
  const [sheet, setSheet] = useState<{ seed: SlotSeed | null; id: number } | null>(null);
  const [sheetSeq, setSheetSeq] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [free, setFree] = useState<FreeSlot[]>([]);
  const requestKey = `${date}:${services.map((service) => service.id).join(",")}:${reloadToken}`;

  useEffect(() => {
    if (services.length === 0) return;
    let cancelled = false;
    const controller = new AbortController();
    const key = requestKey;
    void Promise.all(services.map(async (service) => {
      const response = await fetch(publicAvailabilityUrl(slug, service.id, date), { signal: controller.signal, cache: "no-store" });
      if (!response.ok) return [] as ListedSlot[];
      const body = await response.json() as { slots?: { startsAt: string }[] };
      return (body.slots ?? []).map((slot): ListedSlot => {
        const time = clockInZone(slot.startsAt, timezone);
        return {
          serviceId: service.id,
          date,
          time,
          label: services.length > 1 ? `${time} · ${service.name}` : time,
        };
      });
    }))
      .then((groups) => {
        if (!cancelled) setFree(groups.flat().map((slot) => ({ ...slot, requestKey: key })));
      })
      .catch(() => {
        if (!cancelled) setFree([]);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [services, slug, date, timezone, requestKey]);

  const visible = services.length === 0 ? [] : free.filter((slot) => slot.requestKey === requestKey);

  function openWith(seed: SlotSeed | null) {
    const id = sheetSeq + 1;
    setSheetSeq(id);
    setSheet({ seed, id });
  }

  function openBlank() {
    openWith(null);
  }

  function openSlot(slot: FreeSlot) {
    openWith({ serviceId: slot.serviceId, date: slot.date, time: slot.time });
  }

  return (
    <div className="grid gap-4 pb-24 sm:pb-0">
      <div className="hidden sm:flex">
        <Button type="button" variant="pix" onClick={openBlank}>Link de horário</Button>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-3 sm:hidden" data-sticky-chrome>
        <Button type="button" variant="pix" className="w-full" onClick={openBlank}>Link de horário</Button>
      </div>
      {services.length === 0 ? (
        <p className="text-sm text-muted">
          {OWNER_NO_DEPOSIT}{" "}
          <Link className="font-semibold text-ink underline underline-offset-4" href={`/dashboard/services?businessId=${businessId}`}>Configurar serviços</Link>
        </p>
      ) : (
        <section aria-label="Horários livres" className="grid gap-2">
          <h2 className="font-display text-lg font-bold">Horários livres</h2>
          {visible.length === 0 ? <p className="text-sm text-muted">Nenhum horário livre nesse dia. Escolha outra data.</p> : (
            <ul className="grid gap-2">
              {visible.map((slot) => (
                <li key={`${slot.serviceId}-${slot.time}`}>
                  <button
                    type="button"
                    onClick={() => openSlot(slot)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="font-semibold tabular-nums text-ink">{slot.label}</span>
                    <span className="text-sm font-semibold text-pix">Gerar link deste horário</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <SentLinks businessId={businessId} date={date} timezone={timezone} reloadToken={reloadToken} />
      {sheet ? (
        <SlotLinkSheet
          key={sheet.id}
          onClose={() => setSheet(null)}
          businessId={businessId}
          slug={slug}
          timezone={timezone}
          today={today}
          services={services}
          mpReady={mpReady}
          seed={sheet.seed}
          onCreated={() => setReloadToken((current) => current + 1)}
        />
      ) : null}
    </div>
  );
}
