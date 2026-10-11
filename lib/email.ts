import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { authEnvSchema, smtpEnvSchema } from "./env";
import { HttpError } from "./http";
import { findActiveDraftByEmail } from "./onboarding/drafts";

/** Fora de produção, grava o link no arquivo do E2E. Em produção o caminho é ignorado; o boot recusa a variável. */
export function magicLinkCapturePath(env: Readonly<Record<string, string | undefined>> = process.env): string | undefined {
  if (env.NODE_ENV === "production") return undefined;
  const capture = env.MAGIC_LINK_CAPTURE_FILE?.trim();
  return capture || undefined;
}

function emailTransport() {
  const env = smtpEnvSchema.parse(process.env);
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
  return { env, transporter };
}

/** Quebra de linha no assunto vira espaço. O valor não entra em log. */
export function mailSubject(subject: string) {
  return subject.replace(/[\r\n]+/g, " ").trim();
}

/** Falha de envio. Sem destinatário, assunto ou nome. */
export function logMailFailure(scope: string) {
  console.error(`[mail] scope=${scope} code=send_failed`);
}

async function deliver(message: { to: string; subject: string; text: string; html?: string }) {
  const { env, transporter } = emailTransport();
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: message.to,
      subject: mailSubject(message.subject),
      text: message.text,
      ...(env.SMTP_REPLY_TO ? { replyTo: env.SMTP_REPLY_TO } : {}),
      ...(message.html ? { html: message.html } : {}),
    });
  } finally {
    transporter.close();
  }
}

export async function verifyEmailTransport() {
  if (magicLinkCapturePath()) return;
  const { transporter } = emailTransport();
  try { await transporter.verify(); }
  finally { transporter.close(); }
}

export const magicLinkEmail = {
  subject: "Seu link para acessar o AgendaPix",
  text: (url: string) => `Acesse o AgendaPix pelo link abaixo. O link vale por 30 minutos e pode ser usado uma vez.\n\n${url}\n\nSe você não pediu este acesso, ignore esta mensagem.`,
};

export async function sendMagicLinkEmail(email: string, url: string) {
  const capture = magicLinkCapturePath();
  if (capture) {
    await mkdir(path.dirname(capture), { recursive: true });
    await writeFile(capture, `${email}\n${url}\n`, "utf8");
    return;
  }
  await deliver({ to: email, subject: magicLinkEmail.subject, text: magicLinkEmail.text(url) });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

function sanitizeBusinessName(name: string) {
  return name.replace(/[\r\n\t]+/g, " ").trim().slice(0, 120);
}

/** Código agrupado para o assunto e o corpo. O assunto leva o código inteiro, não uma máscara. */
export function formatSignInCode(otp: string) {
  const digits = otp.replace(/\D/g, "");
  if (digits.length !== 6) return otp.trim();
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function buildSignInCodeEmail(input: { otp: string; appOrigin: string; draftId?: string | null; businessName?: string | null }) {
  const grouped = formatSignInCode(input.otp);
  const origin = input.appOrigin.replace(/\/$/, "");
  const fragment = `#c=${encodeURIComponent(input.otp)}`;
  const buttonPath = input.draftId
    ? `/onboarding/confirmar?d=${encodeURIComponent(input.draftId)}${fragment}`
    : `/onboarding/confirmar${fragment}`;
  const buttonUrl = `${origin}${buttonPath}`;
  const business = input.businessName ? sanitizeBusinessName(input.businessName) : "";
  const continuation = business
    ? `Ou toque no botão para continuar o cadastro da ${business}:`
    : "Ou toque no botão para continuar o cadastro:";
  const subject = `Seu código do AgendaPix: ${grouped}`;
  const text = `Oi! Seu código é ${grouped}. Ele vale por 30 minutos.\n\n${continuation}\n${buttonUrl}\n\nSe você não pediu este código, pode ignorar este e-mail.`;
  const htmlBusiness = business ? ` da <strong>${escapeHtml(business)}</strong>` : "";
  const html = `<p>Oi! Seu código é <strong>${escapeHtml(grouped)}</strong>. Ele vale por 30 minutos.</p><p>Ou toque no botão para continuar o cadastro${htmlBusiness}:</p><p><a href="${escapeHtml(buttonUrl)}">Entrar no AgendaPix</a></p><p>Se você não pediu este código, pode ignorar este e-mail.</p>`;
  return { subject, text, html, buttonUrl };
}

/** URL absoluta no mesmo host dos outros e-mails. A origem é `BETTER_AUTH_URL`; o projeto não tem `APP_URL`. */
export function appPublicHref(path: string, env: Readonly<Record<string, string | undefined>> = process.env): string {
  const parsed = authEnvSchema.pick({ BETTER_AUTH_URL: true }).safeParse(env);
  if (!parsed.success) return path;
  return new URL(path, new URL(parsed.data.BETTER_AUTH_URL).origin).href;
}

function appOrigin() {
  const env = authEnvSchema.safeParse(process.env);
  if (!env.success) throw new HttpError(503, "auth_unavailable", "O acesso está indisponível. Tente novamente mais tarde.");
  return new URL(env.data.BETTER_AUTH_URL).origin;
}

export async function sendSignInCodeEmail(email: string, otp: string) {
  const draft = await findActiveDraftByEmail(email).catch(() => null);
  const message = buildSignInCodeEmail({
    otp,
    appOrigin: appOrigin(),
    draftId: draft?.id ?? null,
    businessName: draft?.data.business.name ?? null,
  });
  const capture = magicLinkCapturePath();
  if (capture) {
    await mkdir(path.dirname(capture), { recursive: true });
    await writeFile(capture, `${email}\n${message.buttonUrl}\n`, "utf8");
    return;
  }
  await deliver({ to: email, subject: message.subject, text: message.text, html: message.html });
}

export type OwnerMailer = (to: string, subject: string, text: string) => Promise<void>;

/** Mesmo transporte do link de acesso. Não há central de avisos no painel: o e-mail é o aviso. */
export async function sendOwnerEmail(to: string, subject: string, text: string, html?: string) {
  const capture = magicLinkCapturePath();
  if (capture) {
    await mkdir(path.dirname(capture), { recursive: true });
    await writeFile(capture, `${to}\n${subject}\n${text}\n`, "utf8");
    return;
  }
  await deliver({ to, subject, text, html });
}
