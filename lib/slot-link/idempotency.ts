import { SLOT_LINK_IDEMPOTENCY_KEY_PATTERN } from "@/lib/contracts/slot-link";

const PREFIX = "agendapix.slot-link.pay.";
const PHONE = /^\+[1-9][0-9]{7,14}$/;
const POLICY_HASH = /^[a-f0-9]{64}$/;

/** Corpo exato do POST pay. A retomada reenvia este objeto, sem montar de novo. */
export type SlotLinkPayPayload = {
  customer: { name: string; phone: string; cpfCnpj?: string };
  policyHash: string;
};

export type PayKeyRecord = {
  idempotencyKey: string;
  payload?: SlotLinkPayPayload;
  bookingId?: string;
  accessToken?: string;
  expiresAt?: string | null;
  serviceId?: string;
};

/** JSON estável: a primeira tentativa e a retomada saem com as mesmas chaves. */
export function payRequestBody(payload: SlotLinkPayPayload) {
  const customer: SlotLinkPayPayload["customer"] = {
    name: payload.customer.name,
    phone: payload.customer.phone,
  };
  if (payload.customer.cpfCnpj) customer.cpfCnpj = payload.customer.cpfCnpj;
  return { customer, policyHash: payload.policyHash };
}

export type PayKeyStore = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
};

/** SHA-256 hex do token. A chave de armazenamento nunca contém o token. */
export async function slotLinkStorageKey(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${PREFIX}${hex}`;
}

/** UUID aceito pelo POST pay (16–128, base64url ou UUID). */
export function createIdempotencyKey() {
  return crypto.randomUUID();
}

export function memoryPayKeyStore(initial: Record<string, string> = {}): PayKeyStore & { snapshot: Record<string, string> } {
  const snapshot = { ...initial };
  return {
    snapshot,
    get: (key) => (key in snapshot ? snapshot[key] : null),
    set: (key, value) => {
      snapshot[key] = value;
    },
    remove: (key) => {
      delete snapshot[key];
    },
  };
}

function readPayload(value: unknown): SlotLinkPayPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const payload = value as { customer?: { name?: unknown; phone?: unknown; cpfCnpj?: unknown }; policyHash?: unknown };
  const name = payload.customer?.name;
  const phone = payload.customer?.phone;
  if (typeof name !== "string" || name.trim().length < 1 || name.length > 120) return undefined;
  if (typeof phone !== "string" || !PHONE.test(phone)) return undefined;
  if (typeof payload.policyHash !== "string" || !POLICY_HASH.test(payload.policyHash)) return undefined;
  const customer: SlotLinkPayPayload["customer"] = { name, phone };
  if (typeof payload.customer?.cpfCnpj === "string" && payload.customer.cpfCnpj.length > 0) {
    customer.cpfCnpj = payload.customer.cpfCnpj;
  }
  return { customer, policyHash: payload.policyHash };
}

function readRecord(raw: string | null): PayKeyRecord | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PayKeyRecord>;
    if (!data || typeof data.idempotencyKey !== "string" || !SLOT_LINK_IDEMPOTENCY_KEY_PATTERN.test(data.idempotencyKey)) return null;
    return {
      idempotencyKey: data.idempotencyKey,
      payload: readPayload(data.payload),
      bookingId: typeof data.bookingId === "string" ? data.bookingId : undefined,
      accessToken: typeof data.accessToken === "string" ? data.accessToken : undefined,
      expiresAt: typeof data.expiresAt === "string" || data.expiresAt === null ? data.expiresAt : undefined,
      serviceId: typeof data.serviceId === "string" ? data.serviceId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Grava o payload no primeiro toque em Pagar. Um payload já salvo não é trocado:
 * a retomada reenvia o corpo original, mesmo que o formulário mude.
 */
export async function lockPayPayload(
  token: string,
  store: PayKeyStore,
  draft: SlotLinkPayPayload,
  mint: () => string = createIdempotencyKey,
) {
  const { storageKey, record } = await readOrCreatePayKey(token, store, mint);
  if (record.payload) return { storageKey, record, payload: record.payload };
  const payload = payRequestBody(draft);
  const next: PayKeyRecord = { ...record, payload };
  store.set(storageKey, JSON.stringify(next));
  return { storageKey, record: next, payload };
}

/** Lê a chave já guardada ou cria uma e grava. Nunca devolve o token. */
export async function readOrCreatePayKey(token: string, store: PayKeyStore, mint: () => string = createIdempotencyKey) {
  const storageKey = await slotLinkStorageKey(token);
  const current = readRecord(store.get(storageKey));
  if (current) return { storageKey, record: current };
  const record: PayKeyRecord = { idempotencyKey: mint() };
  store.set(storageKey, JSON.stringify(record));
  return { storageKey, record };
}

export async function savePayResume(
  token: string,
  store: PayKeyStore,
  resume: { bookingId: string; accessToken: string; expiresAt: string | null; serviceId: string },
) {
  const storageKey = await slotLinkStorageKey(token);
  const current = readRecord(store.get(storageKey)) ?? { idempotencyKey: createIdempotencyKey() };
  const next: PayKeyRecord = { ...current, ...resume };
  store.set(storageKey, JSON.stringify(next));
  return next;
}

export async function readPayResume(token: string, store: PayKeyStore) {
  const storageKey = await slotLinkStorageKey(token);
  return readRecord(store.get(storageKey));
}

export async function clearPayKey(token: string, store: PayKeyStore) {
  store.remove(await slotLinkStorageKey(token));
}

/** sessionStorage e localStorage. A leitura prefere a sessão desta aba. */
export function browserPayKeyStore(): PayKeyStore {
  const read = (key: string) => {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string) => {
    try { sessionStorage.setItem(key, value); } catch { /* aba privada */ }
    try { localStorage.setItem(key, value); } catch { /* armazenamento cheio */ }
  };
  const remove = (key: string) => {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  };
  return { get: read, set: write, remove };
}
