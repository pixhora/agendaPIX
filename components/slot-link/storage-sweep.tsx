"use client";

import { useEffect } from "react";
import { purgeExpiredBookingSessions } from "@/components/booking/pix-resume";
import { browserSlotLinkStores, purgeExpiredSlotLinkStorage } from "@/lib/slot-link/idempotency";

/** Na abertura do app, apaga chave, payload e token que já venceram. */
export function SlotLinkStorageSweep() {
  useEffect(() => {
    const stores = browserSlotLinkStores();
    purgeExpiredSlotLinkStorage(stores);
    // O fluxo grava `booking_session_*` no sessionStorage. A varredura também
    // apaga a cópia que tenha sobrado no localStorage.
    purgeExpiredBookingSessions(stores.session);
    purgeExpiredBookingSessions(stores.claim);
  }, []);
  return null;
}
