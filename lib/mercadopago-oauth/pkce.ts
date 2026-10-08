import { createHash, randomBytes } from "node:crypto";

/** PKCE S256. O verifier tem 43 caracteres (mínimo da doc: 43–128). */
export function createCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

export function createOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function codeChallengeS256(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
