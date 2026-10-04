import { z } from "zod";
import { backendOrigin } from "../backend-origin";

const sessionSchema = z.object({
  user: z.object({ id: z.string().min(1), name: z.string(), email: z.email() }),
});

export async function getOwnerSession(requestHeaders: Headers) {
  const cookie = requestHeaders.get("cookie");
  if (!cookie) return null;
  try {
    const response = await fetch(`${backendOrigin}/api/auth/get-session`, {
      headers: { cookie }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error();
    const data: unknown = await response.json();
    if (data === null) return null;
    return sessionSchema.parse(data);
  } catch {
    // Falha da autoridade não equivale a logout nem revela detalhes internos.
    throw new Error("Não foi possível verificar seu acesso. Tente novamente.");
  }
}
