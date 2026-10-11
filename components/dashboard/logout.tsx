"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { DASHBOARD_NAV_ICONS } from "@/lib/icons/registry";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { clearOnboardingProgress } from "@/components/onboarding/storage";
import { Button } from "@/components/ui/button";

export function Logout({ compact = false, menu = false }: { compact?: boolean; menu?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      clearOnboardingProgress();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
      setPending(false);
    }
  }
  if (menu) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={signOut}
        className="inline-flex min-h-11 w-full items-center gap-2 rounded-field px-3 text-left text-sm font-semibold text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:text-muted"
      >
        <Icon icon={DASHBOARD_NAV_ICONS.logout} size="md" />
        {pending ? "Saindo…" : "Sair"}
      </button>
    );
  }
  if (compact) {
    return <Button variant="ghost" size="icon" disabled={pending} onClick={signOut} aria-label={pending ? "Saindo…" : "Sair da conta"} title="Sair da conta"><Icon icon={DASHBOARD_NAV_ICONS.logout} size="md" /></Button>;
  }
  return <Button variant="outline" disabled={pending} onClick={signOut}><Icon icon={DASHBOARD_NAV_ICONS.logout} size="md" />{pending ? "Saindo…" : "Sair da conta"}</Button>;
}
