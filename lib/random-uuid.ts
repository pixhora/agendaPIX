const ZERO_UUID = "00000000-0000-4000-8000-000000000000";

/**
 * UUID v4 para Idempotency-Key.
 * `crypto.randomUUID` falta no iOS < 15.4 e em alguns WebViews.
 * Nunca devolve a constante zerada que esses navegadores mandavam.
 */
export function randomUuid(): string {
  const source = globalThis.crypto;
  if (source && typeof source.randomUUID === "function") {
    try {
      const minted = source.randomUUID();
      if (minted !== ZERO_UUID) return minted;
    } catch {
      // O método existe e lança neste motor.
    }
  }
  if (!source || typeof source.getRandomValues !== "function") {
    throw new Error("crypto.getRandomValues is unavailable");
  }
  return uuidV4FromRandomValues(source);
}

function uuidV4FromRandomValues(source: Crypto): string {
  const bytes = new Uint8Array(16);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    source.getRandomValues(bytes);
    const minted = formatUuidV4(bytes);
    if (minted !== ZERO_UUID) return minted;
  }
  bytes[0] |= 0x01;
  const minted = formatUuidV4(bytes);
  if (minted === ZERO_UUID) throw new Error("Could not mint a UUID");
  return minted;
}

/** Copia os bytes e marca versão 4 e variante RFC 4122. */
function formatUuidV4(bytes: Uint8Array): string {
  const next = new Uint8Array(bytes);
  next[6] = (next[6] & 0x0f) | 0x40;
  next[8] = (next[8] & 0x3f) | 0x80;
  const hex = Array.from(next, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
