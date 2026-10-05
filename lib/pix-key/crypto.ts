import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { pixKeyTypes } from "../../db/schema";

const keyHexSchema = z.string().regex(/^[a-fA-F0-9]{64}$/, "Configure PIX_KEY_ENCRYPTION_KEY como 64 caracteres hexadecimais.");
const keyTypeSchema = z.enum(pixKeyTypes);
const emailSchema = z.email().max(77);
const phoneSchema = z.e164().max(16);
const evpSchema = z.uuid();
const digits = (value: string) => value.replace(/\D/g, "");

function validCpf(value: string) {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^([0-9])\1+$/.test(cpf)) return false;
  const calc = (length: number) => {
    const sum = cpf.slice(0, length).split("").reduce((total, char, index) => total + Number(char) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

function validCnpj(value: string) {
  const cnpj = digits(value);
  if (!/^\d{14}$/.test(cnpj) || /^([0-9])\1+$/.test(cnpj)) return false;
  const checkDigit = (base: string) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = base.split("").reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return checkDigit(cnpj.slice(0, 12)) === Number(cnpj[12]) && checkDigit(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

export function normalizePixKey(type: unknown, value: unknown) {
  const keyType = keyTypeSchema.parse(type);
  const input = z.string().trim().min(1).max(100).parse(value);
  if (keyType === "cpf") {
    if (!validCpf(input)) throw new z.ZodError([]);
    return { type: keyType, value: digits(input) };
  }
  if (keyType === "cnpj") {
    if (!validCnpj(input)) throw new z.ZodError([]);
    return { type: keyType, value: digits(input) };
  }
  const schema = keyType === "email" ? emailSchema : keyType === "phone" ? phoneSchema : evpSchema;
  return { type: keyType, value: schema.parse(input).toLowerCase() };
}

export const pixKeyInputSchema = z.object({ type: keyTypeSchema, value: z.string().trim().min(1).max(100) }).strict();

function encryptionKey(encoded: string = process.env.PIX_KEY_ENCRYPTION_KEY ?? "") {
  const hex = keyHexSchema.parse(encoded);
  return Buffer.from(hex, "hex");
}

export function encryptPixKey(value: string, businessId: string, encodedKey?: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), nonce);
  cipher.setAAD(Buffer.from(businessId, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64"), keyVersion: 1 };
}

export function decryptPixKey(ciphertext: string, nonce: string, businessId: string, encodedKey?: string) {
  const encrypted = Buffer.from(ciphertext, "base64");
  if (encrypted.length < 17) throw new Error("Invalid encrypted Pix key.");
  const iv = Buffer.from(nonce, "base64");
  if (iv.length !== 12) throw new Error("Invalid encrypted Pix key nonce.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  decipher.setAAD(Buffer.from(businessId, "utf8"));
  decipher.setAuthTag(encrypted.subarray(-16));
  return Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString("utf8");
}

export function pixKeyHint(type: typeof pixKeyTypes[number], value: string) {
  if (type === "email") {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 1)}••••@${domain}`;
  }
  return `••••${value.slice(-4)}`;
}
