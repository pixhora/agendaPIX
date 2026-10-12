import { slotLinkPreviewResponseSchema, type SlotLinkPreviewResponse } from "@/lib/contracts/slot-link";
import { formatDayMonth } from "./copy";

export type SlotLinkPreviewView = SlotLinkPreviewResponse;

/** Prévia do contrato: `slot` ou `generic`. Sem kind, não vira cartão de horário. */
export function parseSlotLinkPreview(body: unknown): SlotLinkPreviewView {
  return slotLinkPreviewResponseSchema.parse(body);
}

export type OgCopy = { title: string; description: string };

/** Título e descrição saem só do kind. Sem token e sem status. */
export function slotLinkOgCopy(preview: SlotLinkPreviewView): OgCopy {
  if (preview.kind === "generic") {
    return {
      title: `${preview.businessName} · Agende pelo AgendaPix`,
      description: "Agende pelo AgendaPix.",
    };
  }
  const when = `${formatDayMonth(preview.date)} às ${preview.time}`;
  return {
    title: `${preview.serviceName} · ${when} — ${preview.businessName}`,
    description: "Confirme pagando o sinal no Pix.",
  };
}

/** O que a imagem desenha. Horário passado ou link encerrado não entra no kind generic. */
export function slotLinkOgLines(preview: SlotLinkPreviewView): string[] {
  if (preview.kind === "generic") return [preview.businessName, "Agende pelo AgendaPix"];
  return [preview.businessName, preview.serviceName, `${formatDayMonth(preview.date)} às ${preview.time}`, "Sinal no Pix"];
}

export const UNAVAILABLE_OG_TEXT = "Este horário não está mais disponível";

/**
 * Cartão único de ocupado, expirado, pago e id inexistente.
 * Sem nome de loja: um id que não existe não tem loja, e pintar a loja revelaria quais ids existem.
 */
export const UNAVAILABLE_OG_PREVIEW: SlotLinkPreviewView = {
  kind: "generic",
  businessName: "AgendaPix",
  logoUrl: null,
};

export const UNAVAILABLE_OG_LINES = ["AgendaPix", UNAVAILABLE_OG_TEXT] as const;

export const GENERIC_OG_FALLBACK: SlotLinkPreviewView = {
  kind: "generic",
  businessName: "AgendaPix",
  logoUrl: null,
};
