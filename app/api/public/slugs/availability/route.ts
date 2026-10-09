import { consumeSlugAvailabilityLimit } from "@/lib/abuse-rate-limit";
import { HttpError, json } from "@/lib/http";
import { appPreflight, withAppCors } from "@/lib/origins";
import { ONBOARDING_SEGMENTS, slugAvailability } from "@/lib/slug-availability";

export const runtime = "nodejs";

const segments: readonly string[] = ONBOARDING_SEGMENTS;

export function GET(request: Request) {
  return withAppCors(request, async () => {
    await consumeSlugAvailabilityLimit(request);
    const params = new URL(request.url).searchParams;
    const slug = params.get("slug");
    if (slug === null || slug.length === 0 || slug.length > 200) {
      throw new HttpError(400, "invalid_input", "Confira os dados enviados.", undefined, { fields: { slug: "Informe o link." } });
    }
    const segmentRaw = params.get("segment");
    const ufRaw = params.get("uf");
    const segment = segmentRaw && segments.includes(segmentRaw) ? segmentRaw : null;
    const uf = ufRaw && /^[a-zA-Z]{2}$/.test(ufRaw) ? ufRaw.toLowerCase() : null;
    return json(await slugAvailability(slug, { segment, uf }));
  });
}

export function OPTIONS(request: Request) {
  return appPreflight(request, ["GET"]);
}
