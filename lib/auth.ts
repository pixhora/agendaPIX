import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { APIError, isAPIError } from "better-auth/api";
import { getDb } from "../db";
import * as schema from "../db/schema/auth";
import { sendMagicLinkEmail } from "./email";
import { authEnvSchema } from "./env";
import { logAuthEvent } from "./auth-logger";
import { HttpError } from "./http";

const authErrorBody = {
  code: "AUTHENTICATION_FAILED",
  message: "Não foi possível concluir o acesso. Tente novamente.",
};

function createAuth() {
  const env = authEnvSchema.parse(process.env);
  return betterAuth({
    appName: "Agenda",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    logger: { level: "warn", log: logAuthEvent },
    onAPIError: {
      onError(error) {
        if (isAPIError(error)) return;
        // Better Call registra Error bruto se o hook não devolver um APIError.
        throw new APIError("INTERNAL_SERVER_ERROR", authErrorBody);
      },
    },
    trustedOrigins: [new URL(env.BETTER_AUTH_URL).origin],
    advanced: { disableOriginCheck: false },
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    plugins: [
      magicLink({ storeToken: "hashed", sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(email, url) }),
      {
        id: "safe-auth-errors",
        onResponse: async (response) => {
          if (response.status < 500) return;
          // APIError pode virar resposta antes de passar por onAPIError.
          logAuthEvent("error");
          const headers = new Headers(response.headers);
          headers.set("content-type", "application/json");
          headers.set("cache-control", "no-store");
          headers.delete("content-length");
          headers.delete("content-encoding");
          headers.delete("etag");
          return { response: Response.json(authErrorBody, { status: response.status, headers }) };
        },
      },
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  try { return auth ??= createAuth(); }
  catch {
    logAuthEvent("error");
    throw new HttpError(503, "auth_unavailable", "O acesso está indisponível. Tente novamente mais tarde.");
  }
}
