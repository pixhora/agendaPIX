import type { PublicBusinessData, PublicService, AvailabilitySlot } from "@/components/booking/types";

export interface MockBookingItem {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  startsAt: string; // ISO UTC
  endsAt: string;   // ISO UTC
  timeFormatted: string; // "09:00 - 10:00"
  status: "confirmed" | "pending_payment" | "completed" | "cancelled";
  paidPixAt?: string;
}

export const MOCK_BUSINESS_INFO = {
  name: "Studio Bella",
  slug: "studio-bella",
  city: "São Paulo, SP",
  address: "Rua Oscar Freire, 1420 - Jardins, São Paulo - SP",
  phone: "(11) 98765-4321",
  timezone: "America/Sao_Paulo",
  opensAt: "09:00",
  closesAt: "19:00",
  openDaysText: "Segunda a Sábado",
};

export const MOCK_SERVICES: PublicService[] = [
  {
    id: "srv-corte-fem",
    name: "Corte feminino",
    durationMinutes: 60,
    priceCents: 8000,   // R$ 80,00
    depositCents: 2500, // R$ 25,00
    policySummary: "Com 24 h de antecedência, Studio Bella pode devolver o sinal. Mais perto da hora, o sinal fica com Studio Bella.",
    policyHash: "preview-policy-corte",
    depositPolicy: { refundUntilHours: 24, rescheduleUntilHours: 24 },
    policyDetails: [
      { title: "Até qua, 07 out, 11:30", body: "Cancele e Studio Bella pode devolver o sinal, ou remarque usando o sinal (1 vez).", tone: "ok" },
      { title: "Depois disso", body: "Se cancelar, o sinal fica com Studio Bella.", tone: "warn" },
      { title: "Se faltar", body: "Studio Bella pode devolver o sinal.", tone: "ok" },
      { title: "Como cancelar ou remarcar", body: "Fale com Studio Bella pelo WhatsApp. A devolução não é automática: quem devolve é Studio Bella, da conta Mercado Pago do negócio, depois de confirmar o cancelamento.", tone: "ok" },
    ],
  },
  {
    id: "srv-corte-escova",
    name: "Corte + escova",
    durationMinutes: 90,
    priceCents: 12000,  // R$ 120,00
    depositCents: 4000, // R$ 40,00
  },
  {
    id: "srv-manicure",
    name: "Manicure",
    durationMinutes: 45,
    priceCents: 4500,   // R$ 45,00
    depositCents: 1500, // R$ 15,00
  },
];

export const MOCK_PUBLIC_BUSINESS: PublicBusinessData = {
  name: MOCK_BUSINESS_INFO.name,
  timezone: MOCK_BUSINESS_INFO.timezone,
  services: MOCK_SERVICES,
  address: MOCK_BUSINESS_INFO.city,
  phone: MOCK_BUSINESS_INFO.phone,
};

// Gera slots de disponibilidade mockados para uma data e duração de serviço
export function getMockAvailabilitySlots(
  dateString: string,
  durationMinutes: number = 60
): AvailabilitySlot[] {
  // Horários de atendimento locais no fuso America/Sao_Paulo (UTC-3)
  const baseSlots = [
    { hour: 9, minute: 0, occupied: true },
    { hour: 10, minute: 30, occupied: true },
    { hour: 11, minute: 30, occupied: false },
    { hour: 13, minute: 30, occupied: false },
    { hour: 14, minute: 30, occupied: true },
    { hour: 15, minute: 30, occupied: false },
    { hour: 16, minute: 30, occupied: false },
    { hour: 17, minute: 30, occupied: false },
  ];

  return baseSlots
    .filter((s) => !s.occupied)
    .map((s) => {
      // Converte hora local de São Paulo para ISO UTC (+3h)
      const utcHour = s.hour + 3;
      const startIso = `${dateString}T${String(utcHour).padStart(2, "0")}:${String(
        s.minute
      ).padStart(2, "0")}:00.000Z`;
      const startDate = new Date(startIso);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      return {
        startsAt: startIso,
        endsAt: endDate.toISOString(),
      };
    });
}

// Reservas fictícias do dia para o painel / dashboard
export const MOCK_BOOKINGS: MockBookingItem[] = [
  {
    id: "bk-101",
    customerName: "Camila Rodrigues",
    customerPhone: "(11) 99123-4567",
    serviceId: "srv-corte-fem",
    serviceName: "Corte feminino",
    durationMinutes: 60,
    priceCents: 8000,
    depositCents: 2500,
    startsAt: "2026-10-02T12:00:00.000Z", // 09:00 local BRT
    endsAt: "2026-10-02T13:00:00.000Z",   // 10:00 local BRT
    timeFormatted: "09:00 - 10:00",
    status: "confirmed",
    paidPixAt: "2026-10-02T08:15:00.000Z",
  },
  {
    id: "bk-102",
    customerName: "Juliana Mendes",
    customerPhone: "(11) 98234-5678",
    serviceId: "srv-corte-escova",
    serviceName: "Corte + escova",
    durationMinutes: 90,
    priceCents: 12000,
    depositCents: 4000,
    startsAt: "2026-10-02T13:30:00.000Z", // 10:30 local BRT
    endsAt: "2026-10-02T15:00:00.000Z",   // 12:00 local BRT
    timeFormatted: "10:30 - 12:00",
    status: "confirmed",
    paidPixAt: "2026-10-02T09:40:00.000Z",
  },
  {
    id: "bk-103",
    customerName: "Beatriz Costa",
    customerPhone: "(11) 97345-6789",
    serviceId: "srv-manicure",
    serviceName: "Manicure",
    durationMinutes: 45,
    priceCents: 4500,
    depositCents: 1500,
    startsAt: "2026-10-02T16:00:00.000Z", // 13:00 local BRT
    endsAt: "2026-10-02T16:45:00.000Z",   // 13:45 local BRT
    timeFormatted: "13:00 - 13:45",
    status: "confirmed",
    paidPixAt: "2026-10-02T11:20:00.000Z",
  },
  {
    id: "bk-104",
    customerName: "Fernanda Lima",
    customerPhone: "(11) 96456-7890",
    serviceId: "srv-corte-fem",
    serviceName: "Corte feminino",
    durationMinutes: 60,
    priceCents: 8000,
    depositCents: 2500,
    startsAt: "2026-10-02T17:30:00.000Z", // 14:30 local BRT
    endsAt: "2026-10-02T18:30:00.000Z",   // 15:30 local BRT
    timeFormatted: "14:30 - 15:30",
    status: "confirmed",
    paidPixAt: "2026-10-02T12:05:00.000Z",
  },
  {
    id: "bk-105",
    customerName: "Larissa Souza",
    customerPhone: "(11) 95567-8901",
    serviceId: "srv-manicure",
    serviceName: "Manicure",
    durationMinutes: 45,
    priceCents: 4500,
    depositCents: 1500,
    startsAt: "2026-10-02T19:00:00.000Z", // 16:00 local BRT
    endsAt: "2026-10-02T19:45:00.000Z",   // 16:45 local BRT
    timeFormatted: "16:00 - 16:45",
    status: "pending_payment",
  },
];
