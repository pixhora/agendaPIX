"use client";

import { useEffect } from "react";
import { activeBusinessCookie } from "@/lib/dashboard/active-business";

/** Guarda o negócio aberto para o painel voltar nele depois de um refresh sem ?businessId. */
export function RememberBusiness({ businessId }: { businessId: string }) {
  useEffect(() => {
    try {
      document.cookie = activeBusinessCookie(businessId);
    } catch {
      // Sem cookie, o painel só volta ao primeiro negócio, como antes.
    }
  }, [businessId]);
  return null;
}
