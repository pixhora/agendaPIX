"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MP_CALLBACK_STORAGE_KEY, presentMpCallback } from "@/lib/mercadopago/contract";
import { mpCallbackSessionValue, stripOAuthReturnParams } from "@/lib/onboarding/oauth-return";

/** Lê ?mp= na volta do Mercado Pago, avisa e tira a query da URL. */
export function MercadoPagoCallback() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const mp = searchParams.get("mp");
    const reason = searchParams.get("reason");
    const view = presentMpCallback(mp, reason);
    if (!view) {
      if (!searchParams.has("code") && !searchParams.has("state")) return;
      const params = new URLSearchParams(searchParams.toString());
      stripOAuthReturnParams(params);
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      return;
    }
    const token = `${pathname}:${mp}:${reason ?? ""}`;
    if (seen.current === token) return;
    seen.current = token;
    try {
      sessionStorage.setItem(MP_CALLBACK_STORAGE_KEY, mpCallbackSessionValue(mp, reason));
    } catch {
      // a tela ainda lê a query nesta visita
    }
    toast(view.toast);
    if (pathname === "/onboarding") {
      router.replace("/onboarding/recebimento");
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mp");
    params.delete("reason");
    stripOAuthReturnParams(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}

export function takeMpCallback(): { mp: string | null; reason: string | null } | null {
  try {
    const raw = sessionStorage.getItem(MP_CALLBACK_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(MP_CALLBACK_STORAGE_KEY);
    const parsed = JSON.parse(raw) as { mp?: unknown; reason?: unknown };
    return {
      mp: typeof parsed.mp === "string" ? parsed.mp : null,
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
    };
  } catch {
    return null;
  }
}
