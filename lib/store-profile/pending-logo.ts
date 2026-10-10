/** Arquivo escolhido no cadastro, antes de existir negócio. Não entra no rascunho. */
const PENDING_LOGO_KEY = "agenda_onboarding_logo";

let pending: File | null = null;

function browserStorage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function rememberPendingLogo(file: File | null) {
  pending = file;
  const store = browserStorage();
  if (!file) {
    store?.removeItem(PENDING_LOGO_KEY);
    return;
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    store?.setItem(PENDING_LOGO_KEY, JSON.stringify({
      name: file.name,
      type: file.type,
      base64: bytesToBase64(bytes),
    }));
  } catch {
    // Sem sessionStorage o arquivo fica só nesta aba, até o recarregamento.
  }
}

export function peekPendingLogo(): File | null {
  if (pending) return pending;
  const store = browserStorage();
  const raw = store?.getItem(PENDING_LOGO_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; type?: unknown; base64?: unknown };
    if (typeof parsed.base64 !== "string" || typeof parsed.name !== "string" || parsed.name.length === 0) return null;
    const bytes = base64ToBytes(parsed.base64);
    pending = new File([bytes], parsed.name, { type: typeof parsed.type === "string" ? parsed.type : "image/png" });
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingLogo() {
  pending = null;
  browserStorage()?.removeItem(PENDING_LOGO_KEY);
}
