export const INVALID_EMAIL_MESSAGE = "Digite um e-mail válido, como voce@seunegocio.com.br.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/** A masked draft e-mail (`a•••@…`) cannot be used to sign in. */
export function isUsableEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  if (/[*•]/.test(email)) return false;
  return isValidEmail(email);
}

/** Common domain typos. The sentence is the one in 03 §7. */
const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outloo.com": "outlook.com",
  "yahooo.com": "yahoo.com",
};

export function suggestEmailDomain(email: string): string | null {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return null;
  return DOMAIN_FIXES[domain] ?? null;
}

export function applyEmailDomain(email: string, domain: string): string {
  const local = email.trim().split("@")[0] ?? "";
  return `${local}@${domain}`;
}
