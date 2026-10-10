"use client";

import { useEffect, useState } from "react";
import { fetchSlugAvailability } from "@/lib/onboarding/slug-availability";
import { isPublicSlug, normalizeSlug, RESERVED_BUSINESS_SLUGS } from "@/lib/slug";
import { slugView, type SlugView } from "@/lib/store-profile/slug-ui";

const reserved = new Set<string>(RESERVED_BUSINESS_SLUGS);

type Remote = {
  slug: string;
  phase: "checking" | "ready" | "error" | "rate_limited";
  available?: boolean;
  reason?: "taken" | "reserved" | "invalid" | "too_short" | null;
  suggestions: string[];
};

export function useStoreSlug(value: string, options?: { ownedSlug?: string; paused?: boolean }): SlugView & { retry: () => void } {
  const ownedSlug = options?.ownedSlug ?? "";
  const paused = options?.paused === true;
  const [retryToken, setRetryToken] = useState(0);
  const [remote, setRemote] = useState<Remote | null>(null);
  const finalSlug = normalizeSlug(value, { final: true });
  const owned = ownedSlug.length > 0 && finalSlug === ownedSlug;
  const localStop = !finalSlug || !isPublicSlug(finalSlug) || reserved.has(finalSlug);
  const current = remote?.slug === finalSlug ? remote : null;

  useEffect(() => {
    if (paused || owned || localStop) return;
    const controller = new AbortController();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRemote({ slug: finalSlug, phase: "checking", suggestions: [] });
      void fetchSlugAvailability(finalSlug, controller.signal)
        .then((result) => {
          if (cancelled) return;
          if (!result.ok) {
            setRemote({ slug: finalSlug, phase: result.kind === "rate_limited" ? "rate_limited" : "error", suggestions: [] });
            return;
          }
          setRemote({
            slug: finalSlug,
            phase: "ready",
            available: result.availability.available,
            reason: result.availability.reason,
            suggestions: result.availability.suggestions,
          });
        })
        .catch((error: unknown) => {
          if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
          setRemote({ slug: finalSlug, phase: "error", suggestions: [] });
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [finalSlug, localStop, owned, paused, retryToken]);

  const phase = localStop || owned || paused ? "idle" : current?.phase ?? "checking";
  const view = slugView({
    slug: value,
    phase,
    available: current?.available,
    reason: current?.reason,
    suggestions: current?.suggestions,
    owned,
  });

  return {
    ...view,
    retry: () => setRetryToken((token) => token + 1),
  };
}
