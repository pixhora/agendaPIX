import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { getDb } from "../db";
import * as schema from "../db/schema/auth";
import { sendMagicLinkEmail } from "./email";
import { authEnvSchema } from "./env";
import { logAuthEvent } from "./auth-logger";

function createAuth() {
  const env = authEnvSchema.parse(process.env);
  return betterAuth({
    appName: "Agenda",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    logger: { level: "warn", log: logAuthEvent },
    trustedOrigins: [new URL(env.BETTER_AUTH_URL).origin],
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    plugins: [magicLink({ storeToken: "hashed", sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(email, url) })],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return auth ??= createAuth();
}
