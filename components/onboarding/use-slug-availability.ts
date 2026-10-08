"use client";

import { useEffect, useRef, useState } from "react";
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

export function useSlugAvailability(value: string): SlugSnapshot {
  const clientRef = useRef<SlugAvailabilityClient | null>(null);
  if (!clientRef.current) clientRef.current = new SlugAvailabilityClient();
  const [online, setOnline] = useState(true);
  const [snapshot, setSnapshot] = useState<Omit<SlugSnapshot, "rememberAvailable">>({ slug: "", status: "idle", suggestions: [] });

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    const finalSlug = normalizeSlug(value, { final: true });
    if (!finalSlug) {
      setSnapshot({ slug: "", status: "idle", suggestions: [] });
      return;
    }
    if (!isPublicSlug(finalSlug)) {
      setSnapshot({ slug: finalSlug, status: finalSlug.length < 3 ? "short" : "invalid", suggestions: [] });
      return;
    }
    if (!online) {
      setSnapshot({ slug: finalSlug, status: "offline", suggestions: [] });
      return;
    }
    const cached = client.peek(finalSlug);
    if (cached) {
      setSnapshot(fromAvailability(finalSlug, cached));
      return;
    }

    setSnapshot({ slug: finalSlug, status: "pending", suggestions: [] });
    let cancelled = false;
    let slowTimer = 0;
    const debounceTimer = window.setTimeout(() => {
      slowTimer = window.setTimeout(() => {
        if (!cancelled) {
          setSnapshot((current) => current.slug === finalSlug ? { ...current, status: "checking" } : current);
        }
      }, 300);
      void client.check(finalSlug).then((result) => {
        window.clearTimeout(slowTimer);
        if (cancelled || result.ignored) return;
        if (!result.result.ok) {
          const offlineNow = result.result.kind === "network" && !navigator.onLine;
          setSnapshot({ slug: finalSlug, status: offlineNow ? "offline" : "error", suggestions: [] });
          return;
        }
        setSnapshot(fromAvailability(finalSlug, result.result.availability));
      });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      window.clearTimeout(slowTimer);
      client.invalidate();
    };
  }, [online, value]);

  return {
    ...snapshot,
    rememberAvailable(slug: string) {
      clientRef.current?.remember(slug, {
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
