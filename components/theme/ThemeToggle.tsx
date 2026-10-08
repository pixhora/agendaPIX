"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY, applyTheme, readThemePreference, resolveTheme, type ThemePreference } from "@/lib/theme";

const options: { value: ThemePreference; label: string; short: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", short: "Claro", Icon: Sun },
  { value: "dark", label: "Tema escuro", short: "Escuro", Icon: Moon },
  { value: "system", label: "Seguir o sistema", short: "Sistema", Icon: Monitor },
];

const subscribeNoop = () => () => {};

/** Alternador claro / escuro / sistema. A preferência fica em localStorage. */
export function ThemeToggle({ className, variant = "icons" }: { className?: string; variant?: "icons" | "text" }) {
  const labelId = useId();
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
    <div className={cn("flex flex-wrap items-center gap-2", variant === "text" && className)}>
      {variant === "text" ? <span id={labelId} className="text-sm text-muted">Tema</span> : null}
      <div
        role="radiogroup"
        aria-label={variant === "text" ? undefined : "Tema"}
        aria-labelledby={variant === "text" ? labelId : undefined}
        className={cn(
          "inline-flex items-center rounded-full border border-line bg-surface p-0.5",
          variant === "icons" && className,
        )}
      >
        {options.map(({ value, label, short, Icon }) => {
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
                "inline-flex items-center justify-center rounded-full text-muted transition-feedback hover:text-ink",
                variant === "text" ? "min-h-11 px-3 text-sm font-semibold" : "size-10",
                checked && "bg-ink text-paper hover:text-paper",
              )}
            >
              {variant === "text" ? short : <Icon aria-hidden="true" className="size-4" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
