import type { PublicBusinessData, PublicService } from "./types";

type ListedService = PublicService & { blockedReason?: string | null };

/** Resposta de `listPublicServices`: o motivo vem em `blockedReason`; a tela lê `reason`. */
export type ListedPublicBusiness = {
  name: string;
  timezone: string;
  services: ListedService[];
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  contactWhatsapp?: string | null;
  bookingsPaused?: boolean;
  requiresPayerCpf?: boolean;
  pixRecipientDisplayName?: string | null;
  segment?: string | null;
};

export function toPublicBusinessData(listed: ListedPublicBusiness): PublicBusinessData {
  return {
    name: listed.name,
    timezone: listed.timezone,
    address: listed.address ?? null,
    phone: listed.phone ?? null,
    logoUrl: listed.logoUrl ?? null,
    contactWhatsapp: listed.contactWhatsapp ?? null,
    bookingsPaused: listed.bookingsPaused,
    requiresPayerCpf: listed.requiresPayerCpf,
    pixRecipientDisplayName: listed.pixRecipientDisplayName ?? null,
    segment: listed.segment ?? null,
    services: listed.services.map((service) => {
      const { blockedReason, ...rest } = service;
      return { ...rest, reason: rest.reason ?? blockedReason ?? null };
    }),
  };
}
