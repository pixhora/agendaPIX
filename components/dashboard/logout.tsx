"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function Logout({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
      setPending(false);
    }
  }
  if (compact) {
    return <Button variant="ghost" size="icon" disabled={pending} onClick={signOut} aria-label={pending ? "Saindo…" : "Sair da conta"} title="Sair da conta"><LogOut aria-hidden="true" /></Button>;
  }
  return <Button variant="outline" disabled={pending} onClick={signOut}><LogOut aria-hidden="true" />{pending ? "Saindo…" : "Sair da conta"}</Button>;
}
