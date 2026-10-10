import { aliasTarget, SlugMoved, slugMovedResponse } from "./public-slug";
import { withAppCors } from "../origins";

function isUndefinedTable(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") return false;
    if ("code" in current && current.code === "42P01") return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

/** 308 antes do restante da rota. Só `42P01` segue sem redirect. Um alias do serviço também vira 308. */
export function withPublicSlug(request: Request, slug: string, run: () => Promise<Response>) {
  return withAppCors(request, async () => {
    try {
      const target = await aliasTarget(slug);
      if (target) return slugMovedResponse(request.url, slug, target);
    } catch (error) {
      if (!isUndefinedTable(error)) throw error;
      console.error("[alias] code=42P01");
    }
    try {
      return await run();
    } catch (error) {
      if (error instanceof SlugMoved) return slugMovedResponse(request.url, slug, error.slug);
      throw error;
    }
  });
}
