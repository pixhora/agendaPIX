/** Inteiro ≥ 1, sem zero à esquerda. A mesma regra de `SUBSCRIPTION_MANUAL_ACTIVATION_HOURS`. */
const activationHoursPattern = /^[1-9][0-9]*$/;

/** Horas da ativação manual. Sem a variável, ou com valor inválido, devolve null. */
export function subscriptionActivationHours(env: Readonly<Record<string, string | undefined>> = process.env): number | null {
  const raw = env.SUBSCRIPTION_MANUAL_ACTIVATION_HOURS;
  if (!raw || !activationHoursPattern.test(raw)) return null;
  const hours = Number(raw);
  return Number.isSafeInteger(hours) ? hours : null;
}

/** Regra de preço da landing. Sem a variável, a ativação não promete um prazo. */
export function subscriptionPriceRule(hours: number | null): string {
  const price = "R$ 49/mês, pago pela página de assinatura.";
  if (hours == null) return `${price} Ativação assim que confirmarmos o pagamento.`;
  const unit = hours === 1 ? "hora" : "horas";
  return `${price} Ativação em até ${hours} ${unit} depois do pagamento.`;
}

export const basePlan = {
  name: "AgendaPix",
  audience: "Para quem atende sozinho, com uma agenda só",
  price: "R$ 49",
  unit: "/ mês",
  note: "por negócio · depois do teste grátis",
  cta: "Começar teste grátis",
  href: "/onboarding?plano=base",
  features: [
    "Página pública de agendamento",
    "Pix confirmado quando o pagamento chega",
    "Vários serviços, cada um com seu sinal",
    "Painel no celular e no computador",
    "Lista de clientes",
  ],
} as const;
