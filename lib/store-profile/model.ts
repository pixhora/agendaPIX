import type { OnboardingData, StoreDay } from "@/components/onboarding/types";

export const STORE_WEEKDAYS = [
  { weekday: 1, label: "Seg", name: "segunda-feira" },
  { weekday: 2, label: "Ter", name: "terça-feira" },
  { weekday: 3, label: "Qua", name: "quarta-feira" },
  { weekday: 4, label: "Qui", name: "quinta-feira" },
  { weekday: 5, label: "Sex", name: "sexta-feira" },
  { weekday: 6, label: "Sáb", name: "sábado" },
  { weekday: 0, label: "Dom", name: "domingo" },
] as const;

export function emptyStoreDays(): StoreDay[] {
  return STORE_WEEKDAYS.map((day) => ({ weekday: day.weekday, open: false, opensAt: "", closesAt: "" }));
}

export function normalizeStoreDays(value: unknown): StoreDay[] {
  const empty = emptyStoreDays();
  if (!Array.isArray(value)) return empty;
  return empty.map((day) => {
    const found = value.find((item) => item && typeof item === "object" && (item as StoreDay).weekday === day.weekday) as Partial<StoreDay> | undefined;
    if (!found) return day;
    return {
      weekday: day.weekday,
      open: found.open === true,
      opensAt: typeof found.opensAt === "string" ? found.opensAt : "",
      closesAt: typeof found.closesAt === "string" ? found.closesAt : "",
    };
  });
}

/** True only when the person typed something. Defaults and placeholders never count. */
export function hasUserInput(data: Partial<OnboardingData> | null | undefined): boolean {
  if (!data) return false;
  if (typeof data.businessName === "string" && data.businessName.trim()) return true;
  if (typeof data.slug === "string" && data.slug.trim()) return true;
  if (typeof data.serviceName === "string" && data.serviceName.trim()) return true;
  if (typeof data.email === "string" && data.email.trim()) return true;
  if (typeof data.durationMinutes === "number" && data.durationMinutes > 0) return true;
  if (typeof data.priceCents === "number" && data.priceCents > 0) return true;
  if (typeof data.depositCents === "number" && data.depositCents > 0) return true;
  if (typeof data.logoUrl === "string" && data.logoUrl.length > 0) return true;
  if (Array.isArray(data.days) && data.days.some((day) => day.open || day.opensAt.length > 0 || day.closesAt.length > 0)) return true;
  return false;
}

export function storeInitials(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "").join("");
  return letters ? letters.toLocaleUpperCase("pt-BR") : null;
}
