import { z } from "zod";
import { getAuth } from "../auth";
import { HttpError } from "../http";

const sessionUserSchema = z.object({
  user: z.object({ id: z.string().min(1), email: z.email() }),
});

/** Sessão do dono para as rotas de rascunho. E-mail sempre em minúsculas. */
export async function readRequestSession(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers }).catch(() => {
    throw new HttpError(503, "auth_unavailable", "O acesso está indisponível. Tente novamente mais tarde.");
  });
  if (!session) return null;
  const parsed = sessionUserSchema.safeParse(session);
  if (!parsed.success) throw new HttpError(503, "auth_unavailable", "O acesso está indisponível. Tente novamente mais tarde.");
  return { userId: parsed.data.user.id, email: parsed.data.user.email.toLowerCase() };
}
