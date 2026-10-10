import type { OnboardingData } from "@/components/onboarding/types";
import { businessLogoUrlSchema } from "@/lib/contracts";
import { storeProfileSchema } from "@/lib/onboarding/validation";
import { normalizeSlug } from "@/lib/slug";
import { emptyStoreDays, normalizeStoreDays } from "./model";

export type StoreFieldErrors = {
  name?: string;
  slug?: string;
  serviceName?: string;
  duration?: string;
  price?: string;
  deposit?: string;
  days?: string;
  logo?: string;
  dayTimes?: Record<number, string>;
};

export type StorePayload = {
  business: { name: string; slug: string; timezone: "America/Sao_Paulo"; logoUrl: string };
  service: { name: string; durationMinutes: number; priceCents: number; depositCents: number };
  hours: { weekday: number; opensAt: string; closesAt: string }[];
};

const FIELD_BY_PATH: Record<string, keyof StoreFieldErrors> = {
  name: "name",
  slug: "slug",
  serviceName: "serviceName",
  durationMinutes: "duration",
  priceCents: "price",
  depositCents: "deposit",
  days: "days",
};

export function mapStoreIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): StoreFieldErrors {
  const errors: StoreFieldErrors = {};
  for (const issue of error.issues) {
    const head = issue.path[0];
    if (head === "days" && issue.path.length > 1) {
      const weekday = Number(issue.path[1]);
      errors.dayTimes = { ...errors.dayTimes, [weekday]: issue.message };
      continue;
    }
    const key = typeof head === "string" ? FIELD_BY_PATH[head] : undefined;
    if (key && key !== "dayTimes" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function profileFromOnboarding(data: OnboardingData) {
  return {
    name: data.businessName,
    slug: normalizeSlug(data.slug, { final: true }),
    serviceName: data.serviceName,
    durationMinutes: data.durationMinutes,
    priceCents: data.priceCents,
    depositEnabled: (data.depositMode ?? "none") !== "none",
    depositCents: (data.depositMode ?? "none") === "none" ? 0 : data.depositCents,
    days: normalizeStoreDays(data.days ?? emptyStoreDays()),
  };
}

/** Client validation. An empty form never produces a payload. */
export function storeSubmission(data: OnboardingData, options?: { logoSelected?: boolean }): { ok: true; payload: StorePayload } | { ok: false; errors: StoreFieldErrors } {
  const parsed = storeProfileSchema.safeParse(profileFromOnboarding(data));
  const errors = parsed.success ? {} : mapStoreIssues(parsed.error);
  const logo = businessLogoUrlSchema.safeParse(data.logoUrl);
  if (!logo.success && !options?.logoSelected) errors.logo = "Adicione a logo da loja.";
  if (!parsed.success || errors.logo) return { ok: false, errors };
  const value = parsed.data;
  return {
    ok: true,
    payload: {
      business: {
        name: value.name.trim(),
        slug: value.slug,
        timezone: "America/Sao_Paulo",
        logoUrl: logo.success ? logo.data : "",
      },
      service: {
        name: value.serviceName.trim(),
        durationMinutes: value.durationMinutes,
        priceCents: value.priceCents,
        depositCents: value.depositEnabled ? value.depositCents : 0,
      },
      hours: value.days
        .filter((day) => day.open)
        .map((day) => ({ weekday: day.weekday, opensAt: day.opensAt, closesAt: day.closesAt })),
    },
  };
}

export function submitStore(data: OnboardingData, create: (payload: StorePayload) => void) {
  const result = storeSubmission(data);
  if (!result.ok) return result;
  create(result.payload);
  return result;
}

/** Server `fields` / `details` land on the matching inputs. */
export function storeErrorsFromApiFields(fields: unknown): StoreFieldErrors {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  const errors: StoreFieldErrors = {};
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    const message = typeof value === "string" ? value : null;
    if (!message) continue;
    if (key.includes("logo")) errors.logo = "Adicione a logo da loja.";
    else if (key.includes("slug")) errors.slug = "Esse link já está em uso. Tente outro.";
    else if (key.includes("duration")) errors.duration = "Escolha a duração.";
    else if (key.includes("deposit")) errors.deposit = "O sinal não pode ser maior que o preço.";
    else if (key.includes("price")) errors.price = "Digite o preço.";
    else if (key.includes("hours") || key === "days") errors.days = message.includes("depois") ? undefined : "Abra pelo menos um dia.";
    else if (key.includes("service") && key.includes("name")) errors.serviceName = "Digite o nome do serviço.";
    else if (key.endsWith("name") || key.includes("business")) errors.name = "Digite o nome da sua loja.";
  }
  if (errors.days === undefined) delete errors.days;
  return errors;
}
