import { aliasTarget, SlugMoved, slugMovedResponse, sqlStateOf } from "./public-slug";
import { withAppCors } from "../origins";

/**
 * 308 antes do restante da rota. Um alias do serviço também vira 308.
 * Se a consulta de alias falhar, loga só o SQLSTATE e segue sem redirect, como o proxy.
 */
export function withPublicSlug(request: Request, slug: string, run: () => Promise<Response>) {
  return withAppCors(request, async () => {
    try {
      const target = await aliasTarget(slug);
      if (target) return slugMovedResponse(request.url, slug, target);
    } catch (error) {
      console.error(`[alias] code=${sqlStateOf(error)}`);
    }
    try {
      return await run();
    } catch (error) {
      if (error instanceof SlugMoved) return slugMovedResponse(request.url, slug, error.slug);
      throw error;
    }
  });
}
