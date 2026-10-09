export type ApiErrorBody = {
  code: string;
  suggestions?: string[];
  retryAfter?: number;
  publicPath?: string;
  fields?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return items.length > 0 ? items : undefined;
}

/** Every API error is `{ error: { code, ... } }`. Callers branch on `code`, never on message text. */
export async function readApiError(response: Response): Promise<ApiErrorBody> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const top = asRecord(body);
  const error = asRecord(top?.error);
  const headerRetry = Number(response.headers.get("Retry-After"));
  const retryFromBody = error?.retryAfter;
  const retryAfter = typeof retryFromBody === "number" && Number.isFinite(retryFromBody)
    ? retryFromBody
    : Number.isFinite(headerRetry) && headerRetry > 0
      ? headerRetry
      : undefined;
  const publicPath = typeof error?.publicPath === "string"
    ? error.publicPath
    : typeof top?.publicPath === "string"
      ? top.publicPath
      : undefined;
  return {
    code: typeof error?.code === "string" && error.code.length > 0 ? error.code : "unknown",
    suggestions: stringList(error?.suggestions),
    retryAfter,
    publicPath,
    fields: error?.fields,
  };
}

export function retryAfterMinutes(retryAfterSeconds: number | undefined): number | null {
  if (retryAfterSeconds == null || !Number.isFinite(retryAfterSeconds)) return null;
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}
