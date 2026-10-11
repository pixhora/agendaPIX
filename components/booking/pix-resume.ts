/** O mínimo para retomar o Pix neste separador. Sem nome, telefone ou CPF. */
export type PixResumeSession = {
  bookingId: string;
  accessToken: string;
  expiresAt: string | null;
  serviceId: string;
};

export const PIX_RESUME_STORAGE_PREFIX = "booking_session_";

export function pixResumeStorageKey(slug: string): string {
  return `${PIX_RESUME_STORAGE_PREFIX}${slug}`;
}

/** Valor do servidor: ainda não lemos o sessionStorage deste separador. */
export const PIX_RESUME_UNKNOWN = "\u0000";

const pixResumeListeners = new Set<() => void>();

export function subscribePixResume(listener: () => void) {
  pixResumeListeners.add(listener);
  return () => {
    pixResumeListeners.delete(listener);
  };
}

export function getPixResumeServerSnapshot(): string {
  return PIX_RESUME_UNKNOWN;
}

export function readPixResumeRaw(slug: string): string {
  try {
    return sessionStorage.getItem(pixResumeStorageKey(slug)) ?? "";
  } catch {
    return "";
  }
}

/** Grava ou apaga a retomada e avisa quem está na tela. Sem mudança, não avisa. */
export function replacePixResume(slug: string, value: string | null) {
  const key = pixResumeStorageKey(slug);
  try {
    const current = sessionStorage.getItem(key);
    if (value === null) {
      if (current === null) return;
      sessionStorage.removeItem(key);
    } else if (current === value) {
      return;
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {
    return;
  }
  for (const listener of pixResumeListeners) listener();
}

/** Apaga retomadas de Pix vencidas. expiresAt nulo fica: a agenda pública ainda retoma. */
export function purgeExpiredBookingSessions(
  store: { keys(): string[]; get(key: string): string | null; remove(key: string): void },
  now = Date.now(),
) {
  for (const key of store.keys()) {
    if (!key.startsWith(PIX_RESUME_STORAGE_PREFIX)) continue;
    const session = readPixResume(store.get(key));
    if (!session || (session.expiresAt !== null && new Date(session.expiresAt).getTime() <= now)) {
      store.remove(key);
    }
  }
}

export function readPixResume(raw: string | null): PixResumeSession | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.bookingId !== "string" || record.bookingId.length === 0) return null;
  if (typeof record.accessToken !== "string" || record.accessToken.length === 0) return null;
  if (typeof record.serviceId !== "string" || record.serviceId.length === 0) return null;
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : null;
  return { bookingId: record.bookingId, accessToken: record.accessToken, expiresAt, serviceId: record.serviceId };
}

export function pixResumePayload(session: PixResumeSession): string {
  return JSON.stringify({
    bookingId: session.bookingId,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    serviceId: session.serviceId,
  });
}

/** Sessão antiga: só os 4 campos. Sem eles, devolve null para a página apagar a sessão. */
export function migratedPixResumePayload(raw: string): string | null {
  const session = readPixResume(raw);
  if (!session) return null;
  return pixResumePayload(session);
}

/** Retoma só quando o `bookingId` da URL é o mesmo da sessão e o prazo ainda não passou. */
export function shouldResumePix(session: PixResumeSession | null, bookingIdFromUrl: string | undefined, now = Date.now()): boolean {
  if (!session || !bookingIdFromUrl || session.bookingId !== bookingIdFromUrl) return false;
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= now) return false;
  return true;
}

/** Sessão do mesmo horário, já vencida: apaga em vez de retomar. */
export function shouldClearExpiredResume(session: PixResumeSession | null, bookingIdFromUrl: string | undefined, now = Date.now()): boolean {
  if (!session || !bookingIdFromUrl || session.bookingId !== bookingIdFromUrl) return false;
  return Boolean(session.expiresAt && new Date(session.expiresAt).getTime() <= now);
}
