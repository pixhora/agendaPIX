"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import styles from "./login-form.module.css";

export function LoginForm({ linkError = false }: { linkError?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(linkError ? "Este link não está disponível. Solicite um novo link de acesso." : "");
  const [sent, setSent] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  return <div className={`${styles.root} flex min-h-dvh flex-col bg-background text-foreground`}>
    <header className={`${styles.surface} border-b border-border px-4 sm:px-6`}>
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4">
        <Link href="/" aria-label="Agenda, início" className={`${styles.display} inline-flex min-h-11 items-center gap-2.5 rounded-field text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}>
          <span aria-hidden="true" className={`${styles.brand} flex size-8 items-center justify-center rounded-field text-base`}>A</span>
          Agenda
        </Link>
        <span className="text-sm text-muted-foreground">Painel do negócio</span>
      </div>
    </header>
    <main id="content" className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8 sm:py-12">
      <section aria-labelledby="login-title" className={`${styles.surface} rounded-2xl border border-border p-6 shadow-sm sm:p-8`}>
        <h1 id="login-title" className={`${styles.display} text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]`}>Entre no seu painel</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">Digite seu email para receber um link de acesso. Não precisa de senha.</p>
        <form className="mt-7 grid gap-5" aria-busy={pending} onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const form = new FormData(event.currentTarget);
          setPending(true); setError(""); setSent(false);
          try {
            const result = await authClient.signIn.magicLink({ email: String(form.get("email")), callbackURL: new URL("/dashboard", window.location.origin).href, errorCallbackURL: new URL("/dashboard/login?error=link", window.location.origin).href });
            if (result.error) throw new Error();
            setSent(true);
          } catch { setError("Não foi possível enviar o link. Confira seu email e tente novamente."); }
          finally { setPending(false); }
        }}>
          <div className="grid gap-2">
            <label className="text-sm font-semibold" htmlFor="email">Seu email</label>
            <input id="email" name="email" type="email" autoComplete="email" required disabled={pending} aria-describedby={`email-hint${error ? " login-error" : ""}`} placeholder="voce@exemplo.com.br" className={`${styles.surface} min-h-12 min-w-0 w-full rounded-lg border border-muted-foreground px-3.5 text-base placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60`} />
            <p id="email-hint" className="text-sm text-muted-foreground">Use o email da sua conta.</p>
          </div>
          {error && <p id="login-error" ref={errorRef} tabIndex={-1} role="alert" className="rounded-card border border-line bg-surface p-4 text-sm leading-relaxed text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{error}</p>}
          {sent && <p role="status" className="rounded-card border border-line bg-surface p-4 text-sm leading-relaxed"><strong className="block font-semibold">Confira sua caixa de entrada</strong>Confira também a pasta de spam. Abra o link para entrar.</p>}
          {pending && <p role="status" className="sr-only">Enviando link de acesso…</p>}
          <Button disabled={pending} type="submit" className="min-h-12 w-full rounded-full px-4 text-base font-semibold">{pending ? "Enviando link…" : "Receber link de acesso"}</Button>
        </form>
      </section>
      <p className="mt-5 text-center text-sm text-muted-foreground">Seus horários, em um só lugar.</p>
    </main>
  </div>;
}
