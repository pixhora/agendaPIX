"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY, applyTheme, readThemePreference, resolveTheme, type ThemePreference } from "@/lib/theme";

const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", Icon: Sun },
  { value: "dark", label: "Tema escuro", Icon: Moon },
  { value: "system", label: "Seguir o sistema", Icon: Monitor },
];

const subscribeNoop = () => () => {};

/** Alternador claro / escuro / sistema. A preferência fica em localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [preference, setPreference] = useState<ThemePreference>(() => (typeof window === "undefined" ? "system" : readThemePreference()));

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(resolveTheme(preference, media.matches));
    sync();
    if (preference !== "system") return;
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [preference]);

  function choose(value: ThemePreference) {
    setPreference(value);
    try {
      if (value === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Sem localStorage: vale só nesta página.
    }
  }

  return (
    <div role="radiogroup" aria-label="Tema" className={cn("inline-flex items-center rounded-full border border-line bg-surface p-0.5", className)}>
      {options.map(({ value, label, Icon }) => {
        const checked = hydrated && preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-full text-muted transition-feedback hover:text-ink",
              checked && "bg-ink text-paper hover:text-paper",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
