import { createHash } from "node:crypto";
import { renderSlotLinkOg } from "./og-image";
import { UNAVAILABLE_OG_LINES, UNAVAILABLE_OG_PREVIEW, type SlotLinkPreviewView } from "./preview";
import { slotLinkPageHeaders } from "./privacy";

export function ogPngHeaders(body: Uint8Array): [string, string][] {
  const headers: [string, string][] = [
    ["Content-Type", "image/png"],
    ["Content-Length", String(body.byteLength)],
    ["ETag", `"${createHash("sha256").update(body).digest("hex")}"`],
  ];
  for (const header of slotLinkPageHeaders()) headers.push([header.key, header.value]);
  return headers;
}

function pngResponse(body: Uint8Array) {
  return new Response(body.slice(), { status: 200, headers: ogPngHeaders(body) });
}

let unavailableBytes: Promise<Uint8Array> | null = null;

async function loadUnavailableBytes() {
  const image = await renderSlotLinkOg(UNAVAILABLE_OG_PREVIEW, UNAVAILABLE_OG_LINES);
  return new Uint8Array(await image.arrayBuffer());
}

/** Um render só. Ocupado, expirado, pago e id inexistente devolvem estes bytes. */
export function unavailableSlotLinkOgBytes() {
  unavailableBytes ??= loadUnavailableBytes();
  return unavailableBytes;
}

export async function unavailableSlotLinkOgResponse() {
  return pngResponse(await unavailableSlotLinkOgBytes());
}

export async function availableSlotLinkOgResponse(preview: Extract<SlotLinkPreviewView, { kind: "slot" }>) {
  const image = await renderSlotLinkOg(preview);
  return pngResponse(new Uint8Array(await image.arrayBuffer()));
}
