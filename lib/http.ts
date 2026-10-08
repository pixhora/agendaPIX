import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterSeconds?: number,
    public details?: Record<string, unknown>,
  ) { super(message); }
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleHttp(run: () => Promise<Response>) {
  try { return await run(); }
  catch (error) {
    if (error instanceof HttpError) {
      const response = json({ error: { code: error.code, message: error.message, ...error.details } }, error.status);
      if (error.retryAfterSeconds) response.headers.set("Retry-After", String(Math.max(1, Math.ceil(error.retryAfterSeconds))));
      return response;
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: { code: "invalid_input", message: "Confira os dados enviados." } }, 400);
    // Drizzle mantém o erro do PostgreSQL como causa.
    const cause = error instanceof Error && error.cause ? error.cause : error;
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23P01") {
      return json({ error: { code: "slot_unavailable", message: "Esse horário já foi reservado. Escolha outro." } }, 409);
    }
    return json({ error: { code: "internal_error", message: "Não foi possível concluir. Tente novamente." } }, 500);
  }
}

export const MAX_BODY_BYTES = 16384;

export async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "body_too_large", "Os dados enviados ultrapassam o limite permitido.");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}
