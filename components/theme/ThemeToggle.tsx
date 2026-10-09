"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY, applyTheme, readThemePreference, resolveTheme, type ThemePreference } from "@/lib/theme";

const options: { value: ThemePreference; label: string; short: string; icon: "sun" | "moon" | "monitor" }[] = [
  { value: "light", label: "Tema claro", short: "Claro", icon: "sun" },
  { value: "dark", label: "Tema escuro", short: "Escuro", icon: "moon" },
  { value: "system", label: "Seguir o sistema", short: "Sistema", icon: "monitor" },
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
        {options.map(({ value, label, short, icon }) => {
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
              {variant === "text" ? short : <ThemeIcon name={icon} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeIcon({ name }: { name: "sun" | "moon" | "monitor" }) {
  const props = {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    className: "size-4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "sun") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  if (name === "moon") {
    return (
      <svg {...props}>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
