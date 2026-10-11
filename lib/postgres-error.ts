/** Caminha `cause` até achar o código do Postgres (o Drizzle embrulha o erro do driver). */
export function isPostgresCode(error: unknown, code: string) {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export function isUndefinedColumn(error: unknown) {
  return isPostgresCode(error, "42703");
}
