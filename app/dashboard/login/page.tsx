import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Rota legada do painel: o login único do app é `/login`.
 * Encaminha `error` e `next` (o `/login` valida o destino).
 */
export default async function DashboardLoginRedirect({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const forwarded = new URLSearchParams();
  for (const key of ["error", "next"] as const) {
    const value = params[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) forwarded.set(key, single);
  }
  const query = forwarded.toString();
  redirect(query ? `/login?${query}` : "/login");
}
