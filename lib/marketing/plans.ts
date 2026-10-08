import { completoExtraFeatures } from "./roadmap";

export const basePlan = {
  name: "AgendaPix",
  audience: "Para quem atende sozinho ou em dupla",
  price: "R$ 49",
  unit: "/ mês",
  note: "por negócio · depois do teste grátis",
  cta: "Testar 7 dias grátis",
  href: "/onboarding?plano=base",
  guarantee: "Sem cartão. Se não assinar, só os novos agendamentos pausam.",
  features: [
    "Agendamentos ilimitados",
    "Sinal no Pix com confirmação automática",
    "Vários serviços, cada um com seu sinal",
    "Painel no celular e no computador",
    "Lista de clientes",
  ],
} as const;

export const upcomingPlan = {
  name: "Completo",
  badge: "Em breve",
  price: "R$ 79",
  unit: "/ mês",
  features: ["Tudo do plano AgendaPix", ...completoExtraFeatures],
} as const;
