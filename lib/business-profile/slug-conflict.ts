import { HttpError } from "../http";

function postgresCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code;
  if (error instanceof Error && error.cause) return postgresCode(error.cause);
  return null;
}

export function isUniqueViolation(error: unknown) {
  return postgresCode(error) === "23505";
}

/** Corrida do índice único (slug atual ou alias) vira 409, sem vazar o erro do banco. */
export function slugTakenError(error: unknown): HttpError | null {
  if (!isUniqueViolation(error)) return null;
  return new HttpError(409, "slug_taken", "Esse endereço já está em uso. Escolha outro.", undefined, {
    details: { constraint: "slug" },
  });
}
