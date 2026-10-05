"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
export function Logout() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return <div><Button variant="outline" disabled={pending} onClick={async () => {
    setPending(true); setError(false);
    try { const result = await authClient.signOut(); if (result.error) throw new Error(); router.replace("/login"); router.refresh(); }
    catch { setError(true); setPending(false); }
  }}>{pending ? "Saindo…" : "Sair da conta"}</Button>{error && <p role="alert">Não foi possível sair. Tente novamente.</p>}</div>;
}
