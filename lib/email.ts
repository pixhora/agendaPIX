import nodemailer from "nodemailer";
import { smtpEnvSchema } from "./env";

export async function sendMagicLinkEmail(email: string, url: string) {
  const env = smtpEnvSchema.parse(process.env);
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Seu link para acessar a Agenda",
    text: `Acesse sua conta pelo link abaixo. O link vale por 5 minutos e pode ser usado uma vez.\n\n${url}\n\nSe você não pediu este acesso, ignore esta mensagem.`,
  });
}
