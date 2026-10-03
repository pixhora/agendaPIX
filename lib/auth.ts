import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { getDb } from "../db";
import * as schema from "../db/schema/auth";
import { sendMagicLinkEmail } from "./email";
import { authEnvSchema } from "./env";

function createAuth() {
  const env = authEnvSchema.parse(process.env);

  // Constrói lista de origens confiáveis: URL principal + extras opcionais
  const mainOrigin = new URL(env.BETTER_AUTH_URL).origin;
  const extraOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS
    ? env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [];
  const trustedOrigins = [...new Set([mainOrigin, ...extraOrigins])];

  return betterAuth({
    appName: "Agenda",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    plugins: [magicLink({ storeToken: "hashed", sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(email, url) })],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return auth ??= createAuth();
}
