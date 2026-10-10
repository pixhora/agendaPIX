import { aliasTarget, SlugMoved, slugMovedResponse } from "./public-slug";
import { withAppCors } from "../origins";

/** 308 antes do restante da rota. Um alias respondido pelo serviço também vira 308. */
export function withPublicSlug(request: Request, slug: string, run: () => Promise<Response>) {
  return withAppCors(request, async () => {
    const target = await aliasTarget(slug);
    if (target) return slugMovedResponse(request.url, slug, target);
    try {
      return await run();
    } catch (error) {
      if (error instanceof SlugMoved) return slugMovedResponse(request.url, slug, error.slug);
      throw error;
    }
  });
}
