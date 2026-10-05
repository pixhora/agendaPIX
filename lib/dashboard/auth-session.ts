import { z } from "zod";
import { getAuth } from "../auth";
import { HttpError } from "../http";

const sessionSchema = z.object({
  user: z.object({ id: z.string().min(1), name: z.string(), email: z.email() }),
});

export async function getOwnerSession(requestHeaders: Headers) {
  try {
    const session = await getAuth().api.getSession({ headers: requestHeaders });
    if (session == null) return null;
    return sessionSchema.parse(session);
  } catch (error) {
    // Infraestrutura indisponível ou payload inválido não equivalem a logout.
    if (error instanceof HttpError || error instanceof z.ZodError || error instanceof Error) {
      throw new Error("Não foi possível verificar seu acesso. Tente novamente.");
    }
    throw new Error("Não foi possível verificar seu acesso. Tente novamente.");
  }
}
