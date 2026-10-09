import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP, magicLink } from "better-auth/plugins";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { getDb } from "../db";
import * as schema from "../db/schema/auth";
import { consumeEmailOtpSendQuota } from "./abuse-rate-limit";
import { sendMagicLinkEmail, sendSignInCodeEmail } from "./email";
import { authEnvSchema } from "./env";
import { logAuthEvent } from "./auth-logger";
import { HttpError } from "./http";
import { buildLoginConfirmUrl } from "./magic-link-confirm";
import { trustedAppOrigins } from "./origins";

const authErrorBody = {
  code: "AUTHENTICATION_FAILED",
  message: "Não foi possível concluir o acesso. Tente novamente.",
};

function createAuth() {
  const env = authEnvSchema.parse(process.env);
  return betterAuth({
    appName: "AgendaPix",
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
    trustedOrigins: trustedAppOrigins(),
    advanced: { disableOriginCheck: false, crossSubDomainCookies: { enabled: false } },
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    plugins: [
      magicLink({
        storeToken: "hashed",
        expiresIn: 1800,
        sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(email, buildLoginConfirmUrl(url)),
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: 1800,
        allowedAttempts: 3,
        storeOTP: "hashed",
        resendStrategy: "rotate",
        // Teto de rajada. O limite de 5/hora por e-mail e 20/hora por IP fica na tabela abuse_rate_limits:
        // este rateLimit vale para todos os caminhos do plugin, inclusive a conferência do código.
        rateLimit: { window: 60, max: 30 },
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in") return;
          await sendSignInCodeEmail(email, otp);
        },
      }),
      {
        id: "otp-send-quota",
        hooks: {
          before: [{
            matcher: (ctx: { path?: string }) => ctx.path === "/email-otp/send-verification-otp",
            handler: createAuthMiddleware(async (ctx) => {
              const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
              if (ctx.body?.type !== "sign-in" || !email) return;
              try {
                await consumeEmailOtpSendQuota(email, ctx.request instanceof Request ? ctx.request : undefined);
              } catch (error) {
                if (error instanceof HttpError && error.status === 429) {
                  throw new APIError("TOO_MANY_REQUESTS", { message: error.message, code: "RATE_LIMITED" });
                }
                if (error instanceof HttpError) throw new APIError("SERVICE_UNAVAILABLE", { message: error.message, code: error.code });
                throw error;
              }
            }),
          }],
        },
      },
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
