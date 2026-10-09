"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isPublicSlug, normalizeSlug } from "@/lib/slug";
import {
  SlugAvailabilityClient,
  type SlugAvailability,
} from "@/lib/onboarding/slug-availability";
import type { SlugVisualStatus } from "@/components/ui/slug-input";

export type SlugSnapshot = {
  slug: string;
  status: SlugVisualStatus;
  suggestions: string[];
  suggestion?: string;
  rememberAvailable: (slug: string) => void;
};

const availabilityClient = new SlugAvailabilityClient();

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function fromAvailability(slug: string, availability: SlugAvailability): Omit<SlugSnapshot, "rememberAvailable"> {
  const suggestion = availability.suggestions[0];
  if (availability.reason === "reserved") {
    return { slug, status: "reserved", suggestions: availability.suggestions, suggestion };
  }
  if (!availability.valid && availability.reason === "too_short") {
    return { slug, status: "short", suggestions: [] };
  }
  if (!availability.valid) {
    return { slug, status: "invalid", suggestions: availability.suggestions, suggestion };
  }
  if (!availability.available || availability.reason === "taken") {
    return { slug, status: "taken", suggestions: availability.suggestions, suggestion };
  }
  return { slug, status: "available", suggestions: [] };
}

function localView(slug: string, online: boolean): Omit<SlugSnapshot, "rememberAvailable"> | null {
  if (!slug) return { slug: "", status: "idle", suggestions: [] };
  if (!isPublicSlug(slug)) return { slug, status: slug.length < 3 ? "short" : "invalid", suggestions: [] };
  if (!online) return { slug, status: "offline", suggestions: [] };
  return null;
}

export function useSlugAvailability(value: string): SlugSnapshot {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const finalSlug = normalizeSlug(value, { final: true });
  const local = localView(finalSlug, online);
  const cached = local ? null : availabilityClient.peek(finalSlug);
  const cachedView = cached ? fromAvailability(finalSlug, cached) : null;
  const [remote, setRemote] = useState<Omit<SlugSnapshot, "rememberAvailable"> | null>(null);
  const currentRemote = remote?.slug === finalSlug ? remote : null;
  const snapshot = local ?? cachedView ?? currentRemote ?? { slug: finalSlug, status: "pending" as const, suggestions: [] };

  useEffect(() => {
    if (localView(finalSlug, online) || availabilityClient.peek(finalSlug)) return;
    let cancelled = false;
    let slowTimer = 0;
    const debounceTimer = window.setTimeout(() => {
      slowTimer = window.setTimeout(() => {
        if (!cancelled) setRemote({ slug: finalSlug, status: "checking", suggestions: [] });
      }, 300);
      void availabilityClient.check(finalSlug).then((result) => {
        window.clearTimeout(slowTimer);
        if (cancelled || result.ignored) return;
        if (!result.result.ok) {
          const offlineNow = result.result.kind === "network" && !navigator.onLine;
          setRemote({ slug: finalSlug, status: offlineNow ? "offline" : "error", suggestions: [] });
          return;
        }
        setRemote(fromAvailability(finalSlug, result.result.availability));
      });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      window.clearTimeout(slowTimer);
      availabilityClient.invalidate();
    };
  }, [finalSlug, online]);

  return {
    ...snapshot,
    rememberAvailable(slug: string) {
      availabilityClient.remember(slug, {
        input: slug,
        normalized: slug,
        valid: true,
        available: true,
        reason: null,
        suggestions: [],
      });
    },
  };
}
