import { SLOT_LINK_IDEMPOTENCY_KEY_PATTERN } from "@/lib/contracts/slot-link";

/** localStorage. Idempotency-Key + nome/WhatsApp. Nunca leva accessToken nem CPF. */
export const SLOT_LINK_CLAIM_PREFIX = "agendapix.slot-link.pay.";
/** sessionStorage. accessToken da reserva. Some ao fechar a aba. */
export const SLOT_LINK_SESSION_PREFIX = "agendapix.slot-link.session.";

const PHONE = /^\+[1-9][0-9]{7,14}$/;
const POLICY_HASH = /^[a-f0-9]{64}$/;

/** Corpo guardado para a retomada. Sem CPF: o digest do pagamento ignora esse campo. */
export type SlotLinkPayPayload = {
  customer: { name: string; phone: string };
  policyHash: string;
};

/** Rascunho do formulário. O CPF só segue no POST desta aba, nunca no armazenamento. */
export type SlotLinkPayDraft = {
  customer: { name: string; phone: string; cpfCnpj?: string };
  policyHash: string;
};

export type PayClaim = {
  idempotencyKey: string;
  payload?: SlotLinkPayPayload;
  expiresAt: string;
};

export type PaySession = {
  bookingId: string;
  accessToken: string;
  serviceId: string;
  expiresAt: string;
};

export type PayResume = PayClaim & {
  bookingId?: string;
  accessToken?: string;
  serviceId?: string;
};

export type KeyedStore = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
};

export type SlotLinkPayStores = {
  claim: KeyedStore;
  session: KeyedStore;
};

/** JSON estável. O CPF entra só quando o rascunho desta aba ainda o tem. */
export function payRequestBody(payload: SlotLinkPayDraft) {
  const customer: SlotLinkPayDraft["customer"] = {
    name: payload.customer.name,
    phone: payload.customer.phone,
  };
  if (payload.customer.cpfCnpj) customer.cpfCnpj = payload.customer.cpfCnpj;
  return { customer, policyHash: payload.policyHash };
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex do token. A chave de armazenamento nunca contém o token. */
export async function slotLinkStorageKey(token: string) {
  return `${SLOT_LINK_CLAIM_PREFIX}${await tokenHash(token)}`;
}

export async function slotLinkSessionKey(token: string) {
  return `${SLOT_LINK_SESSION_PREFIX}${await tokenHash(token)}`;
}

/** UUID aceito pelo POST pay (16–128, base64url ou UUID). */
export function createIdempotencyKey() {
  return crypto.randomUUID();
}

export function memoryKeyedStore(initial: Record<string, string> = {}): KeyedStore & { snapshot: Record<string, string> } {
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
    keys: () => Object.keys(snapshot),
  };
}

export function memorySlotLinkStores(initial?: { claim?: Record<string, string>; session?: Record<string, string> }): SlotLinkPayStores & {
  claim: KeyedStore & { snapshot: Record<string, string> };
  session: KeyedStore & { snapshot: Record<string, string> };
} {
  return {
    claim: memoryKeyedStore(initial?.claim),
    session: memoryKeyedStore(initial?.session),
  };
}

function isFuture(expiresAt: string | undefined, now: number) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time > now;
}

function readPayload(value: unknown): SlotLinkPayPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const payload = value as { customer?: { name?: unknown; phone?: unknown }; policyHash?: unknown };
  const name = payload.customer?.name;
  const phone = payload.customer?.phone;
  if (typeof name !== "string" || name.trim().length < 1 || name.length > 120) return undefined;
  if (typeof phone !== "string" || !PHONE.test(phone)) return undefined;
  if (typeof payload.policyHash !== "string" || !POLICY_HASH.test(payload.policyHash)) return undefined;
  return { customer: { name, phone }, policyHash: payload.policyHash };
}

function readClaim(raw: string | null): PayClaim | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { idempotencyKey?: unknown; payload?: unknown; expiresAt?: unknown };
    if (typeof data.idempotencyKey !== "string" || !SLOT_LINK_IDEMPOTENCY_KEY_PATTERN.test(data.idempotencyKey)) return null;
    if (typeof data.expiresAt !== "string" || !Number.isFinite(new Date(data.expiresAt).getTime())) return null;
    return {
      idempotencyKey: data.idempotencyKey,
      payload: readPayload(data.payload),
      expiresAt: data.expiresAt,
    };
  } catch {
    return null;
  }
}

function readSession(raw: string | null): PaySession | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PaySession>;
    if (typeof data.bookingId !== "string" || data.bookingId.length === 0) return null;
    if (typeof data.accessToken !== "string" || data.accessToken.length === 0) return null;
    if (typeof data.serviceId !== "string" || data.serviceId.length === 0) return null;
    if (typeof data.expiresAt !== "string" || !Number.isFinite(new Date(data.expiresAt).getTime())) return null;
    return {
      bookingId: data.bookingId,
      accessToken: data.accessToken,
      serviceId: data.serviceId,
      expiresAt: data.expiresAt,
    };
  } catch {
    return null;
  }
}

function readLegacyAccess(raw: string | null): PaySession | null {
  return readSession(raw);
}

function serializeClaim(claim: PayClaim) {
  const record: { idempotencyKey: string; payload?: SlotLinkPayPayload; expiresAt: string } = {
    idempotencyKey: claim.idempotencyKey,
    expiresAt: claim.expiresAt,
  };
  if (claim.payload) {
    record.payload = {
      customer: { name: claim.payload.customer.name, phone: claim.payload.customer.phone },
      policyHash: claim.payload.policyHash,
    };
  }
  return JSON.stringify(record);
}

function serializeSession(session: PaySession) {
  return JSON.stringify({
    bookingId: session.bookingId,
    accessToken: session.accessToken,
    serviceId: session.serviceId,
    expiresAt: session.expiresAt,
  });
}

function storedPayload(draft: SlotLinkPayDraft): SlotLinkPayPayload | null {
  return readPayload({
    customer: { name: draft.customer.name, phone: draft.customer.phone },
    policyHash: draft.policyHash,
  }) ?? null;
}

function writeSessionIfAbsent(stores: SlotLinkPayStores, hash: string, access: PaySession, now: number) {
  if (!isFuture(access.expiresAt, now)) return;
  const key = `${SLOT_LINK_SESSION_PREFIX}${hash}`;
  const current = readSession(stores.session.get(key));
  if (current && isFuture(current.expiresAt, now)) return;
  stores.session.set(key, serializeSession({ ...access, expiresAt: access.expiresAt }));
}

function hashFromClaimKey(key: string) {
  return key.startsWith(SLOT_LINK_CLAIM_PREFIX) ? key.slice(SLOT_LINK_CLAIM_PREFIX.length) : null;
}

/** Tira accessToken de registros antigos e apaga o que venceu ou não tem prazo. */
export function purgeExpiredSlotLinkStorage(stores: SlotLinkPayStores, now = Date.now()) {
  for (const key of stores.session.keys()) {
    if (!key.startsWith(SLOT_LINK_CLAIM_PREFIX)) continue;
    const hash = hashFromClaimKey(key);
    const legacy = hash ? readLegacyAccess(stores.session.get(key)) : null;
    if (hash && legacy) writeSessionIfAbsent(stores, hash, legacy, now);
    stores.session.remove(key);
  }

  for (const key of stores.claim.keys()) {
    if (!key.startsWith(SLOT_LINK_CLAIM_PREFIX)) continue;
    const hash = hashFromClaimKey(key);
    const raw = stores.claim.get(key);
    const claim = readClaim(raw);
    const legacy = hash ? readLegacyAccess(raw) : null;
    if (!hash || !claim || !isFuture(claim.expiresAt, now)) {
      stores.claim.remove(key);
      if (hash) stores.session.remove(`${SLOT_LINK_SESSION_PREFIX}${hash}`);
      continue;
    }
    if (legacy) writeSessionIfAbsent(stores, hash, { ...legacy, expiresAt: claim.expiresAt }, now);
    stores.claim.set(key, serializeClaim(claim));
  }

  for (const key of stores.session.keys()) {
    if (!key.startsWith(SLOT_LINK_SESSION_PREFIX)) continue;
    const session = readSession(stores.session.get(key));
    if (!session || !isFuture(session.expiresAt, now)) stores.session.remove(key);
  }
}

/**
 * Grava nome e WhatsApp no primeiro toque em Pagar. Um payload já salvo não é trocado.
 * expiresAt vencido não cria chave nova; um claim ainda válido continua valendo.
 */
export async function lockPayPayload(
  token: string,
  stores: SlotLinkPayStores,
  draft: SlotLinkPayDraft,
  expiresAt: string,
  mint: () => string = createIdempotencyKey,
  now = Date.now(),
) {
  const storageKey = await slotLinkStorageKey(token);
  const current = readClaim(stores.claim.get(storageKey));
  if (current?.payload && isFuture(current.expiresAt, now)) {
    return { storageKey, record: current, payload: current.payload, fresh: false as const };
  }
  const payload = storedPayload(draft);
  if (!payload) return null;
  const existing = await readOrCreatePayKey(token, stores, expiresAt, mint, now);
  if (!existing) return null;
  if (existing.record.payload) return { ...existing, payload: existing.record.payload, fresh: false as const };
  const next: PayClaim = { ...existing.record, payload };
  stores.claim.set(existing.storageKey, serializeClaim(next));
  return { storageKey: existing.storageKey, record: next, payload, fresh: true as const };
}

/** Lê a chave já guardada ou cria uma com expiresAt. Sem prazo futuro, não grava. */
export async function readOrCreatePayKey(
  token: string,
  stores: SlotLinkPayStores,
  expiresAt: string,
  mint: () => string = createIdempotencyKey,
  now = Date.now(),
) {
  const storageKey = await slotLinkStorageKey(token);
  const current = readClaim(stores.claim.get(storageKey));
  if (current && isFuture(current.expiresAt, now)) return { storageKey, record: current };
  stores.claim.remove(storageKey);
  if (!isFuture(expiresAt, now)) return null;
  const record: PayClaim = { idempotencyKey: mint(), expiresAt };
  stores.claim.set(storageKey, serializeClaim(record));
  return { storageKey, record };
}

/** accessToken só na sessão. O claim local só atualiza o prazo do hold. */
export async function savePayAccess(
  token: string,
  stores: SlotLinkPayStores,
  resume: { bookingId: string; accessToken: string; expiresAt: string | null; serviceId: string },
  now = Date.now(),
) {
  const claimKey = await slotLinkStorageKey(token);
  const claim = readClaim(stores.claim.get(claimKey));
  const hold = resume.expiresAt && isFuture(resume.expiresAt, now)
    ? resume.expiresAt
    : claim && isFuture(claim.expiresAt, now)
      ? claim.expiresAt
      : null;
  if (!hold) return null;
  if (claim) stores.claim.set(claimKey, serializeClaim({ ...claim, expiresAt: hold }));
  if (!resume.bookingId || !resume.accessToken || !resume.serviceId) return null;
  const session: PaySession = {
    bookingId: resume.bookingId,
    accessToken: resume.accessToken,
    serviceId: resume.serviceId,
    expiresAt: hold,
  };
  stores.session.set(await slotLinkSessionKey(token), serializeSession(session));
  return session;
}

export async function readPayResume(token: string, stores: SlotLinkPayStores, now = Date.now()): Promise<PayResume | null> {
  const claimKey = await slotLinkStorageKey(token);
  const sessionKey = await slotLinkSessionKey(token);
  const hash = hashFromClaimKey(claimKey);
  const legacySession = stores.session.get(claimKey);
  if (legacySession && hash) {
    const legacy = readLegacyAccess(legacySession);
    if (legacy) writeSessionIfAbsent(stores, hash, legacy, now);
    stores.session.remove(claimKey);
  }

  const raw = stores.claim.get(claimKey);
  const claim = readClaim(raw);
  if (!claim || !isFuture(claim.expiresAt, now)) {
    if (raw) stores.claim.remove(claimKey);
    stores.session.remove(sessionKey);
    return null;
  }
  const legacy = hash ? readLegacyAccess(raw) : null;
  if (legacy && hash) writeSessionIfAbsent(stores, hash, { ...legacy, expiresAt: claim.expiresAt }, now);
  if (raw !== serializeClaim(claim)) stores.claim.set(claimKey, serializeClaim(claim));

  let session = readSession(stores.session.get(sessionKey));
  if (session && !isFuture(session.expiresAt, now)) {
    stores.session.remove(sessionKey);
    session = null;
  }
  return {
    idempotencyKey: claim.idempotencyKey,
    payload: claim.payload,
    expiresAt: claim.expiresAt,
    bookingId: session?.bookingId,
    accessToken: session?.accessToken,
    serviceId: session?.serviceId,
  };
}

export async function clearPayKey(token: string, stores: SlotLinkPayStores) {
  const claimKey = await slotLinkStorageKey(token);
  stores.claim.remove(claimKey);
  stores.session.remove(claimKey);
  stores.session.remove(await slotLinkSessionKey(token));
}

function browserKeyedStore(kind: "local" | "session"): KeyedStore {
  const area = () => {
    try {
      return kind === "local" ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try { return area()?.getItem(key) ?? null; } catch { return null; }
    },
    set(key, value) {
      try { area()?.setItem(key, value); } catch { /* cheio ou bloqueado */ }
    },
    remove(key) {
      try { area()?.removeItem(key); } catch { /* ignore */ }
    },
    keys() {
      try {
        const storage = area();
        if (!storage) return [];
        const names: string[] = [];
        for (let index = 0; index < storage.length; index += 1) {
          const name = storage.key(index);
          if (name) names.push(name);
        }
        return names;
      } catch {
        return [];
      }
    },
  };
}

/** Claim no localStorage. Sessão (accessToken) só no sessionStorage. */
export function browserSlotLinkStores(): SlotLinkPayStores {
  return {
    claim: browserKeyedStore("local"),
    session: browserKeyedStore("session"),
  };
}
