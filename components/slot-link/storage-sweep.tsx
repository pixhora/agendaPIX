"use client";

import { useEffect } from "react";
import { purgeExpiredBookingSessions } from "@/components/booking/pix-resume";
import { browserSlotLinkStores, purgeExpiredSlotLinkStorage } from "@/lib/slot-link/idempotency";

/** Na abertura do app, apaga chave, payload e token que já venceram. */
export function SlotLinkStorageSweep() {
  useEffect(() => {
    const stores = browserSlotLinkStores();
    purgeExpiredSlotLinkStorage(stores);
    // O BookingFlow grava `booking_session_*` no sessionStorage, não no localStorage.
    purgeExpiredBookingSessions(stores.session);
  }, []);
  return null;
}
