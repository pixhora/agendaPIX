// lib/privacy/mask-email.ts
// Fonte única da máscara de e-mail (onboarding #27 e conta Mercado Pago #32).
// "ana.souza@gmail.com" -> "an••@gmail.com"; "ab@x.com" -> "a••@x.com"; "a@x.com" -> "a••@x.com".
const MASK = "••";

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const local = Array.from(trimmed.slice(0, at));
  const domain = trimmed.slice(at + 1).toLowerCase();
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible.join("")}${MASK}@${domain}`;
}
