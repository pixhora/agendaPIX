"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { businessNameSchema, businessSlugSchema } from "@/lib/contracts";
import { normalizeSlug } from "@/lib/slug";
import { fetchSlugAvailability } from "@/lib/onboarding/slug-availability";
import { patchBusinessProfile } from "@/lib/store-profile/profile-client";
import { OLD_SLUG_REDIRECT_READY } from "@/lib/store-profile/redirect";
import { profileErrorCopy } from "@/lib/store-profile/api-copy";
import { SLUG_COPY } from "@/lib/store-profile/slug-ui";
import { LogoUpload } from "./LogoUpload";
import { SlugField } from "./SlugField";
import { useStoreSlug } from "./use-store-slug";

export function StoreSettingsForm({
  businessId,
  initialName,
  initialSlug,
  initialLogoUrl,
  prefix,
}: {
  businessId: string;
  initialName: string;
  initialSlug: string;
  initialLogoUrl: string | null;
  prefix: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [baseline, setBaseline] = useState({ name: initialName, slug: initialSlug, logoUrl: initialLogoUrl });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forcedTaken, setForcedTaken] = useState(false);
  const [forcedCopy, setForcedCopy] = useState<string | null>(null);
  const [takenSuggestions, setTakenSuggestions] = useState<string[]>([]);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const finalSlug = normalizeSlug(slug, { final: true });
  const dirty = name !== baseline.name || finalSlug !== baseline.slug || logoUrl !== baseline.logoUrl;
  const slugState = useStoreSlug(slug, { ownedSlug: baseline.slug, paused: pending });
  const status = forcedTaken ? "taken" as const : slugState.status;
  const message = status === "taken" && forcedTaken ? (forcedCopy ?? SLUG_COPY.taken) : slugState.message;
  const suggestions = status === "taken" && forcedTaken ? takenSuggestions.slice(0, 2) : slugState.suggestions;
  const nameOk = businessNameSchema.safeParse(name).success;
  const slugOk = businessSlugSchema.safeParse(finalSlug).success;
  const profileDirty = name !== baseline.name || finalSlug !== baseline.slug;
  const canSave = profileDirty && !pending && status === "available" && nameOk && slugOk;

  useEffect(() => {
    if (!dirty) return;
    const onBefore = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveHref(href);
    };
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  async function save() {
    if (!canSave) return;
    const patch: { name?: string; slug?: string } = {};
    if (name !== baseline.name) patch.name = name.trim();
    if (finalSlug !== baseline.slug) patch.slug = finalSlug;
    setPending(true);
    setError(null);
    const result = await patchBusinessProfile(businessId, patch);
    setPending(false);
    if (!result.ok) {
      if (result.code === "slug_conflict_retry" || result.code === "slug_taken" || result.status === 409) {
        setForcedTaken(true);
        setForcedCopy(result.code === "slug_conflict_retry" ? result.message : null);
        const checked = await fetchSlugAvailability(finalSlug, new AbortController().signal);
        setTakenSuggestions(result.suggestions.length ? result.suggestions : checked.ok ? checked.availability.suggestions : []);
        document.getElementById("settings-slug")?.focus();
        return;
      }
      setError(result.message || profileErrorCopy(result.code));
      document.getElementById("settings-form-error")?.focus();
      return;
    }
    setBaseline({ name: patch.name ?? baseline.name, slug: patch.slug ?? baseline.slug, logoUrl });
    if (patch.slug) setSlug(patch.slug);
    setForcedTaken(false);
    setForcedCopy(null);
    toast("Alterações salvas.");
    router.refresh();
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {error ? <div id="settings-form-error" role="alert" tabIndex={-1} className="rounded-card border border-destructive/40 p-3 text-sm text-destructive">{error}</div> : null}
      <div className="grid gap-1.5">
        <Label htmlFor="settings-name">Nome da loja</Label>
        <Input id="settings-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        <p className="text-sm text-muted-foreground">{name.length}/60</p>
      </div>
      <SlugField
        id="settings-slug"
        prefix={prefix}
        value={slug}
        status={status}
        message={message}
        suggestions={suggestions}
        disabled={pending}
        onRetry={slugState.retry}
        onValueChange={(next) => {
          setForcedTaken(false);
          setForcedCopy(null);
          setSlug(next);
        }}
        onPickSuggestion={(suggestion) => {
          setForcedTaken(false);
          setForcedCopy(null);
          setSlug(suggestion);
        }}
      />
      {OLD_SLUG_REDIRECT_READY && finalSlug !== baseline.slug ? (
        <p role="status" className="rounded-card border border-border bg-subtle p-3 text-sm">
          Seu link antigo ({prefix ? `${prefix}/` : ""}{baseline.slug}) vai continuar funcionando e levar para o novo.
        </p>
      ) : null}
      <LogoUpload
        url={logoUrl}
        businessId={businessId}
        disabled={pending}
        onChangeUrl={(next) => {
          if (!next) return;
          setLogoUrl(next);
          setBaseline((current) => ({ ...current, logoUrl: next }));
          toast("Alterações salvas.");
        }}
      />
      <Button type="submit" size="lg" disabled={!canSave}>
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {pending ? "Salvando…" : "Salvar alterações"}
      </Button>
      {leaveHref ? (
        <div role="dialog" aria-modal="true" aria-labelledby="leave-title" className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-4 sm:place-items-center">
          <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5">
            <h2 id="leave-title" className="font-display text-xl font-bold">Sair sem salvar?</h2>
            <div className="mt-4 grid gap-2">
              <Button type="button" variant="danger" onClick={() => { window.location.assign(leaveHref); }}>Sair sem salvar</Button>
              <Button type="button" variant="outline" onClick={() => setLeaveHref(null)}>Voltar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
