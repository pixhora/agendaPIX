"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isOfflineError, readApiErrorCode } from "@/components/booking/booking-error";
import { SLOT_LINK_STATUS_LABEL, cancelFailure, clockInZone, formatDayMonth, isoDateInZone, reissueFailure, weekdayShort } from "@/lib/slot-link/copy";
import { ownerFromCreated, parseCreatedLink, parseOwnerLink, parseOwnerList, slotLinkReadyView, type OwnerLink, type SlotLinkReadyView } from "@/lib/slot-link/owner-link";
import { cancelSlotLinkUrl, ownerSlotLinksUrl, reissueSlotLinkUrl } from "@/lib/slot-link/paths";
import { ReissueDialog } from "./reissue-dialog";

export function SentLinks({
  businessId,
  slug,
  date,
  timezone,
  reloadToken = 0,
  onReady,
}: {
  businessId: string;
  slug: string;
  date: string;
  timezone: string;
  reloadToken?: number;
  onReady: (ready: SlotLinkReadyView) => void;
}) {
  const [links, setLinks] = useState<OwnerLink[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [reissueLink, setReissueLink] = useState<OwnerLink | null>(null);
  const [reissueError, setReissueError] = useState<string | null>(null);
  const [reissueFinal, setReissueFinal] = useState(false);
  const [reissueConnect, setReissueConnect] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelFinal, setCancelFinal] = useState(false);
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

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await load();
      setLinks(page.links);
      setCursor(page.nextCursor);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [load]);

  function dismissCancel() {
    const shouldReload = cancelFinal;
    setConfirmCancelId(null);
    setCancelError(null);
    setCancelFinal(false);
    if (shouldReload) void reload();
  }

  function dismissReissue() {
    if (reissueLink && busyId === reissueLink.id) return;
    const shouldReload = reissueFinal;
    setReissueLink(null);
    setReissueError(null);
    setReissueFinal(false);
    setReissueConnect(false);
    if (shouldReload) void reload();
  }

  async function cancel(link: OwnerLink) {
    setBusyId(link.id);
    setNotice(null);
    setCancelError(null);
    try {
      const response = await fetch(cancelSlotLinkUrl(businessId, link.id), { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const outcome = cancelFailure(readApiErrorCode(body), response.status);
        setCancelError(outcome.message);
        setCancelFinal(outcome.final);
        return;
      }
      const updated = parseOwnerLink(body);
      setLinks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setConfirmCancelId(null);
      setCancelFinal(false);
    } catch (error) {
      setCancelError(isOfflineError(error) ? "Sem conexão. Verifique sua internet e tente de novo." : cancelFailure(null, 500).message);
      setCancelFinal(false);
    } finally {
      setBusyId(null);
    }
  }

  async function reissue(link: OwnerLink) {
    setBusyId(link.id);
    setReissueError(null);
    setReissueConnect(false);
    setNotice(null);
    try {
      const response = await fetch(reissueSlotLinkUrl(businessId, link.id), { method: "POST", cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const outcome = reissueFailure(readApiErrorCode(body), response.status);
        setReissueError(outcome.message);
        setReissueFinal(outcome.final);
        setReissueConnect(outcome.connect);
        return;
      }
      const created = parseCreatedLink(body);
      const listed = ownerFromCreated(created);
      setLinks((current) => [
        listed,
        ...current.map((item) => (item.id === link.id ? { ...item, status: "replaced" as const, cancellable: false } : item)),
      ]);
      onReady(slotLinkReadyView(created, slug, timezone, window.location.origin));
      setReissueLink(null);
      setReissueFinal(false);
    } catch (error) {
      setReissueError(isOfflineError(error) ? "Sem conexão. Verifique sua internet e tente de novo." : reissueFailure(null, 500).message);
      setReissueFinal(false);
      setReissueConnect(false);
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
          {links.map((link) => {
            const pending = link.status === "pending";
            const day = isoDateInZone(link.startsAt, timezone);
            return (
              <li key={link.id} className="grid gap-2 rounded-card border border-line bg-surface p-4">
                {pending && link.customerLabel ? <p className="font-semibold text-ink">{link.customerLabel}</p> : null}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink">{link.service.name}</p>
                  <p className="text-sm font-semibold text-ink">{SLOT_LINK_STATUS_LABEL[link.status]}</p>
                </div>
                <p className="text-sm text-muted">{weekdayShort(day)}, {formatDayMonth(day)}</p>
                <p className="text-sm font-semibold tabular-nums text-ink">{clockInZone(link.startsAt, timezone)}</p>
                {pending ? (
                  <Button type="button" variant="outline" className="justify-self-start" onClick={() => { setReissueError(null); setReissueLink(link); }}>
                    Gerar novo link
                  </Button>
                ) : null}
                {pending && link.cancellable ? (
                  confirmCancelId === link.id ? (
                    <div className="grid gap-2 rounded-field bg-subtle p-3">
                      <p className="text-sm text-ink">Cancelar este link? A cliente deixa de conseguir pagar.</p>
                      {cancelError ? <p role="alert" className="text-sm text-danger">{cancelError}</p> : null}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="danger" disabled={busyId === link.id} onClick={() => void cancel(link)}>Cancelar link</Button>
                        <Button type="button" variant="outline" onClick={dismissCancel}>Manter link</Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="ghost" className="justify-self-start px-0" onClick={() => { setCancelError(null); setCancelFinal(false); setConfirmCancelId(link.id); }}>Cancelar link</Button>
                  )
                ) : null}
              </li>
            );
          })}
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
      {reissueLink ? (
        <ReissueDialog
          pending={busyId === reissueLink.id}
          error={reissueError}
          connectHref={reissueConnect ? `/dashboard/settings?businessId=${businessId}#recebimento` : null}
          onCancel={dismissReissue}
          onConfirm={() => void reissue(reissueLink)}
        />
      ) : null}
    </section>
  );
}
