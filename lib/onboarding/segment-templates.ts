import type { OnboardingData, StoreDay } from "@/components/onboarding/types";
import { STORE_WEEKDAYS } from "@/lib/store-profile/model";
import type { OnboardingSegment } from "./draft";
import type { STORE_DURATION_MINUTES } from "./validation";

/**
 * Ponto de partida por tipo de negócio no cadastro: nome do serviço, duração e horário comum.
 * Nunca sugere preço nem sinal (decisão do dono). "outro" só registra o segmento.
 */
export type SegmentTemplate = {
  label: string;
  serviceName: string;
  durationMinutes: (typeof STORE_DURATION_MINUTES)[number];
  weekdays: number[];
  opensAt: string;
  closesAt: string;
};

const TUE_SAT = [2, 3, 4, 5, 6];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const MON_FRI = [1, 2, 3, 4, 5];

export const SEGMENT_TEMPLATES: Record<Exclude<OnboardingSegment, "outro">, SegmentTemplate> = {
  barbearia: { label: "Barbearia", serviceName: "Corte masculino", durationMinutes: 30, weekdays: TUE_SAT, opensAt: "09:00", closesAt: "19:00" },
  salao: { label: "Salão", serviceName: "Corte feminino", durationMinutes: 60, weekdays: TUE_SAT, opensAt: "09:00", closesAt: "19:00" },
  unhas: { label: "Unhas", serviceName: "Pé e mão", durationMinutes: 90, weekdays: MON_SAT, opensAt: "09:00", closesAt: "18:00" },
  cilios: { label: "Cílios", serviceName: "Extensão de cílios", durationMinutes: 120, weekdays: MON_SAT, opensAt: "09:00", closesAt: "18:00" },
  estetica: { label: "Estética", serviceName: "Limpeza de pele", durationMinutes: 60, weekdays: MON_SAT, opensAt: "09:00", closesAt: "18:00" },
  tattoo: { label: "Tatuagem", serviceName: "Sessão de tatuagem", durationMinutes: 120, weekdays: TUE_SAT, opensAt: "10:00", closesAt: "19:00" },
  personal: { label: "Personal", serviceName: "Aula de personal", durationMinutes: 60, weekdays: MON_FRI, opensAt: "06:00", closesAt: "21:00" },
  saude: { label: "Saúde", serviceName: "Consulta", durationMinutes: 60, weekdays: MON_FRI, opensAt: "08:00", closesAt: "18:00" },
};

/** Ordem dos botões no cadastro. */
export const SEGMENT_CHOICES: { segment: OnboardingSegment; label: string }[] = [
  ...Object.entries(SEGMENT_TEMPLATES).map(([segment, template]) => ({ segment: segment as OnboardingSegment, label: template.label })),
  { segment: "outro", label: "Outro" },
];

export function segmentTemplate(segment: string | undefined): SegmentTemplate | null {
  return segment && segment in SEGMENT_TEMPLATES ? SEGMENT_TEMPLATES[segment as keyof typeof SEGMENT_TEMPLATES] : null;
}

export function templateDays(template: SegmentTemplate): StoreDay[] {
  return STORE_WEEKDAYS.map(({ weekday }) => template.weekdays.includes(weekday)
    ? { weekday, open: true, opensAt: template.opensAt, closesAt: template.closesAt }
    : { weekday, open: false, opensAt: "", closesAt: "" });
}

function sameDays(a: StoreDay[] | undefined, b: StoreDay[]) {
  if (!a) return false;
  return b.every((day) => {
    const other = a.find((item) => item.weekday === day.weekday);
    if (!other) return false;
    if (!day.open) return !other.open;
    return other.open && other.opensAt === day.opensAt && other.closesAt === day.closesAt;
  });
}

const noDayOpen = (days: StoreDay[] | undefined) => !days || days.every((day) => !day.open);

/**
 * O que muda ao escolher o segmento. Só preenche campo vazio ou que ainda está com o valor
 * do modelo anterior: o que o dono digitou nunca é sobrescrito. Preço e sinal ficam intactos.
 */
export function applySegmentTemplate(data: OnboardingData, segment: OnboardingSegment): Partial<OnboardingData> {
  const patch: Partial<OnboardingData> = { segment };
  const next = segmentTemplate(segment);
  if (!next) return patch;
  const previous = segmentTemplate(data.segment);

  const name = data.serviceName.trim();
  if (!name || (previous && name === previous.serviceName)) patch.serviceName = next.serviceName;
  if (data.durationMinutes <= 0 || (previous && data.durationMinutes === previous.durationMinutes)) {
    patch.durationMinutes = next.durationMinutes;
  }
  if (noDayOpen(data.days) || (previous && sameDays(data.days, templateDays(previous)))) {
    patch.days = templateDays(next);
  }
  return patch;
}
