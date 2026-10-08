import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { HttpError } from "../http";

const VERSION = "v1";
const keyHexSchema = z.string().regex(/^[a-fA-F0-9]{64}$/);

function aad(businessId: string, purpose: "access" | "refresh") {
  return `${businessId}:${purpose}`;
}

function encryptionKey(encoded: string) {
  return Buffer.from(keyHexSchema.parse(encoded), "hex");
}

/** AES-256-GCM com MP_TOKEN_ENCRYPTION_KEY. O pacote é `v1.nonce.ciphertext`; não há coluna de nonce. */
export function encryptMpToken(value: string, businessId: string, purpose: "access" | "refresh", encodedKey?: string) {
  try {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey ?? process.env.MP_TOKEN_ENCRYPTION_KEY ?? ""), nonce);
    cipher.setAAD(Buffer.from(aad(businessId, purpose), "utf8"));
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]);
    return `${VERSION}.${nonce.toString("base64")}.${ciphertext.toString("base64")}`;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "mp_oauth_unconfigured", "A conexão com o Mercado Pago ainda não está configurada.");
  }
}

export function decryptMpToken(packed: string, businessId: string, purpose: "access" | "refresh", encodedKey?: string) {
  const [version, nonce, ciphertext, extra] = packed.split(".");
  if (version !== VERSION || !nonce || !ciphertext || extra) throw new Error("token_unreadable");
  try {
    const encrypted = Buffer.from(ciphertext, "base64");
    if (encrypted.length < 17) throw new Error("token_unreadable");
    const iv = Buffer.from(nonce, "base64");
    if (iv.length !== 12) throw new Error("token_unreadable");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(encodedKey ?? process.env.MP_TOKEN_ENCRYPTION_KEY ?? ""), iv);
    decipher.setAAD(Buffer.from(aad(businessId, purpose), "utf8"));
    decipher.setAuthTag(encrypted.subarray(-16));
    return Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.message === "token_unreadable") throw error;
    throw new Error("token_unreadable");
  }
}
