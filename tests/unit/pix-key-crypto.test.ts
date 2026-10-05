import { describe, expect, it } from "vitest";
import { decryptPixKey, encryptPixKey, normalizePixKey, pixKeyHint } from "../../lib/pix-key/crypto";

const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const businessId = "6e4b4a1b-d218-4e6a-92c9-94de45059c4f";

describe("Pix key encryption", () => {
  it("round-trips with AES-GCM and random nonce", () => {
    const first = encryptPixKey("dono@example.com", businessId, key);
    const second = encryptPixKey("dono@example.com", businessId, key);
    expect(decryptPixKey(first.ciphertext, first.nonce, businessId, key)).toBe("dono@example.com");
    expect(first.nonce).not.toBe(second.nonce);
    expect(() => decryptPixKey(first.ciphertext, first.nonce, "different-business", key)).toThrow();
  });

  it("rejects modified ciphertext and invalid key material", () => {
    const encrypted = encryptPixKey("dono@example.com", businessId, key);
    const bytes = Buffer.from(encrypted.ciphertext, "base64");
    bytes[0] ^= 1;
    expect(() => decryptPixKey(bytes.toString("base64"), encrypted.nonce, businessId, key)).toThrow();
    expect(() => encryptPixKey("x", businessId, "not-a-key")).toThrow();
  });

  it("normalizes and validates keys before encryption", () => {
    expect(normalizePixKey("email", " DONO@EXAMPLE.COM ")).toEqual({ type: "email", value: "dono@example.com" });
    expect(() => normalizePixKey("phone", "11999999999")).toThrow();
    expect(() => normalizePixKey("cpf", "111.111.111-11")).toThrow();
    expect(pixKeyHint("email", "dono@example.com")).toBe("d••••@example.com");
    expect(pixKeyHint("evp", "12345678-1234-4234-8234-123456789abc")).toBe("••••9abc");
  });
});
