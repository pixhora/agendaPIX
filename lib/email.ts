import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { smtpEnvSchema } from "./env";

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

export async function verifyEmailTransport() {
  if (process.env.MAGIC_LINK_CAPTURE_FILE) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MAGIC_LINK_CAPTURE_FILE não pode estar definida em produção.");
    }
    return;
  }
  const { transporter } = emailTransport();
  try { await transporter.verify(); }
  finally { transporter.close(); }
}

export async function sendMagicLinkEmail(email: string, url: string) {
  const capture = process.env.MAGIC_LINK_CAPTURE_FILE;
  if (capture) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MAGIC_LINK_CAPTURE_FILE não pode estar definida em produção.");
    }
    await mkdir(path.dirname(capture), { recursive: true });
    await writeFile(capture, `${email}\n${url}\n`, "utf8");
    return;
  }
  const { env, transporter } = emailTransport();
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Seu link para acessar a Agenda",
    text: `Acesse sua conta pelo link abaixo. O link vale por 5 minutos e pode ser usado uma vez.\n\n${url}\n\nSe você não pediu este acesso, ignore esta mensagem.`,
  });
}
