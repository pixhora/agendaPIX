"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
export function LoginForm({ linkError = false }: { linkError?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(linkError ? "Este link não está disponível. Solicite um novo link de acesso." : "");
  const [sent, setSent] = useState(false);
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-8"><h1 className="text-[28px] font-semibold">Entre no seu painel</h1><p className="text-muted-foreground">Receba um link por email para cuidar dos seus horários. Não precisa de senha.</p>
    <form className="grid gap-4" onSubmit={async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); setPending(true); setError(""); setSent(false);
      try { const result = await authClient.signIn.magicLink({ email: String(form.get("email")), callbackURL: "/dashboard", errorCallbackURL: "/dashboard/login?error=link" }); if (result.error) throw new Error(); setSent(true); }
      catch { setError("Não foi possível enviar o link. Confira seu email e tente novamente."); }
      finally { setPending(false); }
    }}>
      <label className="grid gap-2" htmlFor="email">Seu email<input id="email" name="email" type="email" autoComplete="email" required className="min-h-11 rounded-md border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" /></label>
      {error && <p role="alert">{error}</p>}{sent && <p role="status">Confira sua caixa de entrada e a pasta de spam. Abra o link para entrar.</p>}
      <Button disabled={pending} type="submit">{pending ? "Enviando link…" : "Receber link de acesso"}</Button>
    </form></main>;
}
