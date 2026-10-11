import type { ZodType } from "zod";

/**
 * Lê o schema do contrato. Se a Forja acrescentar um campo, tira a chave
 * desconhecida e tenta de novo — o front não quebra no rebase da #77.
 */
export function parseContract<T>(schema: ZodType<T>, body: unknown): T {
  const first = schema.safeParse(body);
  if (first.success) return first.data;
  const clone = structuredClone(body);
  let removed = false;
  for (const issue of first.error.issues) {
    if (issue.code !== "unrecognized_keys" || !Array.isArray(issue.keys)) continue;
    const path = issue.path ?? [];
    for (const key of issue.keys) {
      if (deleteAt(clone, path, key)) removed = true;
    }
  }
  if (!removed) throw first.error;
  return schema.parse(clone);
}

function deleteAt(root: unknown, path: PropertyKey[], key: string) {
  let cursor = root;
  for (const segment of path) {
    if (!cursor || typeof cursor !== "object") return false;
    cursor = (cursor as Record<PropertyKey, unknown>)[segment];
  }
  if (!cursor || typeof cursor !== "object" || !(key in cursor)) return false;
  delete (cursor as Record<string, unknown>)[key];
  return true;
}
