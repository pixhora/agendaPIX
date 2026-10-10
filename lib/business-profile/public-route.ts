import { aliasTarget, SlugMoved, slugMovedResponse } from "./public-slug";
import { withAppCors } from "../origins";

/** 308 antes do restante da rota. Falha de alias segue sem redirect. Um alias do serviço também vira 308. */
export function withPublicSlug(request: Request, slug: string, run: () => Promise<Response>) {
  return withAppCors(request, async () => {
    try {
      const target = await aliasTarget(slug);
      if (target) return slugMovedResponse(request.url, slug, target);
    } catch {
      // Tabela de alias ausente ou banco fora: segue sem redirect e sem detalhe.
    }
    try {
      return await run();
    } catch (error) {
      if (error instanceof SlugMoved) return slugMovedResponse(request.url, slug, error.slug);
      throw error;
    }
  });
}
