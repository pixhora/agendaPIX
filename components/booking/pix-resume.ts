/** O mínimo para retomar o Pix neste separador. Sem nome, telefone ou CPF. */
export type PixResumeSession = {
  bookingId: string;
  accessToken: string;
  expiresAt: string | null;
  serviceId: string;
};

export function pixResumeStorageKey(slug: string): string {
  return `booking_session_${slug}`;
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
