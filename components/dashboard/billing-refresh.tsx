"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { subscriptionActivatedToast } from "@/lib/dashboard/subscription-ui";

const toasted = new Set<string>();

/** Atualiza a cobrança quando a pessoa volta do WhatsApp. O card em si continua no servidor. */
export function BillingRefresh({ businessId, pending, active }: { businessId: string; pending: boolean; active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const key = `agendapix-subscription-pending:${businessId}`;
    let wasPending = false;
    try { wasPending = sessionStorage.getItem(key) === "1"; } catch { /* sem storage: sem toast */ }
    const message = subscriptionActivatedToast(wasPending, pending, active);
    try {
      if (pending) sessionStorage.setItem(key, "1");
      else sessionStorage.removeItem(key);
    } catch { /* segue sem persistir */ }
    if (message && !toasted.has(businessId)) {
      toasted.add(businessId);
      toast.success(message);
    }
  }, [active, businessId, pending]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
