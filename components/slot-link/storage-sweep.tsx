"use client";

import { useEffect } from "react";
import { purgeExpiredBookingSessions } from "@/components/booking/pix-resume";
import { browserSlotLinkStores, purgeExpiredSlotLinkStorage } from "@/lib/slot-link/idempotency";

/** Na abertura do app, apaga chave, payload e token que já venceram. */
export function SlotLinkStorageSweep() {
  useEffect(() => {
    const stores = browserSlotLinkStores();
    purgeExpiredSlotLinkStorage(stores);
    purgeExpiredBookingSessions(stores.session);
  }, []);
  return null;
}
