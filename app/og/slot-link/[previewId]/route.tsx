import { readSlotLinkPreview } from "@/lib/bookings/slot-link";
import { bookingClientIdentity } from "@/lib/bookings/rate-limit";
import { isSlotLinkPreviewId } from "@/lib/bookings/slot-link-token";
import { renderSlotLinkOg } from "@/lib/slot-link/og-image";
import { GENERIC_OG_FALLBACK, parseSlotLinkPreview, type SlotLinkPreviewView } from "@/lib/slot-link/preview";
import { slotLinkPageHeaders } from "@/lib/slot-link/privacy";

export const runtime = "nodejs";

async function previewFor(previewId: string, identity: string | null): Promise<SlotLinkPreviewView> {
  if (!isSlotLinkPreviewId(previewId)) return GENERIC_OG_FALLBACK;
  try {
    return parseSlotLinkPreview(await readSlotLinkPreview(previewId, identity));
  } catch {
    return GENERIC_OG_FALLBACK;
  }
}

/** Imagem da prévia. previewId conhecido responde 200 nos dois kinds; generic não é 404. */
export async function GET(request: Request, context: RouteContext<"/og/slot-link/[previewId]">) {
  const { previewId } = await context.params;
  const image = await renderSlotLinkOg(await previewFor(previewId, bookingClientIdentity(request)));
  for (const header of slotLinkPageHeaders()) image.headers.set(header.key, header.value);
  return image;
}
