"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { confirmRedirectPath, loginErrorDestination } from "@/lib/magic-link-confirm";
import { safeNextPath } from "@/lib/safe-redirect";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function decodeCookieValue(value: string) {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

function applySetCookies(response: Response, jar: Awaited<ReturnType<typeof cookies>>) {
  const list = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const header of list) {
    const [pair, ...attributes] = header.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const options: { httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string; maxAge?: number; expires?: Date } = {};
    for (const attribute of attributes) {
      const [rawKey, ...rest] = attribute.split("=");
      const key = rawKey.toLowerCase();
      const raw = rest.join("=");
      if (key === "httponly") options.httpOnly = true;
      else if (key === "secure") options.secure = true;
      else if (key === "path" && raw) options.path = raw;
      else if (key === "max-age" && raw) options.maxAge = Number(raw);
      else if (key === "expires" && raw) options.expires = new Date(raw);
      else if (key === "samesite") {
        const site = raw.toLowerCase();
        if (site === "lax" || site === "strict" || site === "none") options.sameSite = site;
      }
    }
    // O header já vem codificado. cookies().set codifica de novo; sem o decode a sessão não gruda.
    jar.set(pair.slice(0, separator), decodeCookieValue(pair.slice(separator + 1)), options);
  }
}

/** O botão confirma o acesso. Abrir a página não chama esta ação. */
export async function confirmLoginAction(formData: FormData) {
  const token = field(formData, "token");
  const callbackURL = safeNextPath(field(formData, "callbackURL"));
  if (!token) redirect(loginErrorDestination(field(formData, "errorCallbackURL")));
  const response = await getAuth().api.magicLinkVerify({
    query: {
      token,
      callbackURL,
      errorCallbackURL: loginErrorDestination(field(formData, "errorCallbackURL")),
      newUserCallbackURL: safeNextPath(field(formData, "newUserCallbackURL"), callbackURL),
    },
    headers: await headers(),
    asResponse: true,
  });
  applySetCookies(response, await cookies());
  redirect(confirmRedirectPath(response.headers.get("location"), callbackURL));
}
