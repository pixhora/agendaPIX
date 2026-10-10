"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SLOT_LINK_STATUS_LABEL, clockInZone } from "@/lib/slot-link/copy";
import { parseOwnerLink, parseOwnerList, type OwnerLink } from "@/lib/slot-link/owner-link";
import { cancelSlotLinkUrl, ownerSlotLinksUrl } from "@/lib/slot-link/paths";
import { isOfflineError } from "@/components/booking/booking-error";

export function SentLinks({
  businessId,
  date,
  timezone,
  reloadToken = 0,
}: {
  businessId: string;
  date: string;
  timezone: string;
  reloadToken?: number;
}) {
  const [links, setLinks] = useState<OwnerLink[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (nextCursor?: string) => {
    const params = new URLSearchParams({ date });
    if (nextCursor) params.set("cursor", nextCursor);
    const response = await fetch(`${ownerSlotLinksUrl(businessId)}?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("links");
    return parseOwnerList(await response.json());
  }, [businessId, date]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((page) => {
        if (cancelled) return;
        setLinks(page.links);
        setCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [load, reloadToken]);

  async function cancel(link: OwnerLink) {
    setBusyId(link.id);
    setNotice(null);
    try {
      const response = await fetch(cancelSlotLinkUrl(businessId, link.id), { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice("Não deu para cancelar agora. Tente de novo.");
        return;
      }
      const updated = parseOwnerLink(body);
      setLinks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setConfirmId(null);
    } catch (error) {
      setNotice(isOfflineError(error) ? "Sem conexão. Verifique sua internet e tente de novo." : "Não deu para cancelar agora. Tente de novo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-label="Links enviados" className="grid gap-3" data-testid="sent-links">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Links enviados</h2>
      </div>
      <p aria-live="polite" className="sr-only">{notice}</p>
      {notice ? <p role="alert" className="text-sm text-danger">{notice}</p> : null}
      {status === "loading" ? <Skeleton className="h-24 w-full rounded-card" /> : null}
      {status === "error" ? (
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-ink">Não deu para carregar os links. Tente de novo.</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void load().then((page) => { setLinks(page.links); setCursor(page.nextCursor); setStatus("ready"); }).catch(() => setStatus("error"))}>Tentar de novo</Button>
        </div>
      ) : null}
      {status === "ready" && links.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-4 py-6 text-sm text-muted">Nenhum link enviado neste dia. Gere um link de um horário livre.</p>
      ) : null}
      {status === "ready" && links.length > 0 ? (
        <ol className="grid gap-2">
          {links.map((link) => (
            <li key={link.id} className="grid gap-2 rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">{link.customerLabel ?? link.service.name}</p>
                <p className="text-sm font-semibold text-ink">{SLOT_LINK_STATUS_LABEL[link.status]}</p>
              </div>
              <p className="text-sm text-muted">{link.service.name} · {clockInZone(link.startsAt, timezone)}</p>
              {link.cancellable ? (
                confirmId === link.id ? (
                  <div className="grid gap-2 rounded-field bg-subtle p-3">
                    <p className="text-sm text-ink">Cancelar este link? A cliente deixa de conseguir pagar.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="danger" disabled={busyId === link.id} onClick={() => void cancel(link)}>Cancelar link</Button>
                      <Button type="button" variant="outline" onClick={() => setConfirmId(null)}>Manter link</Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="ghost" className="justify-self-start px-0" onClick={() => setConfirmId(link.id)}>Cancelar link</Button>
                )
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {cursor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(cursor).then((page) => {
            setLinks((current) => [...current, ...page.links]);
            setCursor(page.nextCursor);
          }).catch(() => setNotice("Não deu para carregar os links. Tente de novo."))}
        >
          Carregar mais
        </Button>
      ) : null}
    </section>
  );
}
