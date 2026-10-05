export interface OnboardingData {
  plan: "base" | "completo";
  businessName: string;
  slug: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  openDays: number[]; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  opensAt: string;    // "09:00"
  closesAt: string;   // "19:00"
  email: string;
}
