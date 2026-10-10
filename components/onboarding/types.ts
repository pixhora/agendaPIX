export type DepositMode = "20" | "30" | "50" | "custom" | "none";

export type StoreDay = {
  weekday: number;
  open: boolean;
  opensAt: string;
  closesAt: string;
};

export type OnboardingStep = "business" | "service" | "hours" | "email" | "code" | "creating";

export interface OnboardingData {
  plan: "base" | "completo";
  businessName: string;
  slug: string;
  /** URL https da logo. Vazio até o upload devolver o endereço. A prévia local não entra aqui. */
  logoUrl: string;
  /** False while the public link still follows the business name. */
  slugTouched?: boolean;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  depositMode?: DepositMode;
  openDays: number[];
  opensAt: string;
  closesAt: string;
  email: string;
  segment?: string;
  /** Opcional. O cadastro novo não pede; o provisionamento antigo ainda aceita. */
  contactWhatsapp?: string;
  /** Sete dias, todos fechados até a pessoa abrir. */
  days?: StoreDay[];
}
