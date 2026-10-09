import { formatMinutes, type PublicBookingFacts } from "./facts";

export function moneyLead(): string {
  return "O cliente paga o sinal por Pix e o valor cai direto na sua conta Mercado Pago, a que você conecta no AgendaPix. A reserva confirma sozinha. Sem cobrar comprovante.";
}

export function holdCardCaption(): string {
  return "é o tempo que o cliente tem para pagar. Se não pagar, o código Pix vence e o horário volta para a sua agenda sozinho.";
}

export function minutesUnit(count: number): string {
  return count === 1 ? "minuto" : "minutos";
}

export function holdAnswer(holdMinutes: number): string {
  return `${formatMinutes(holdMinutes)} depois de escolher o horário. Se o Pix não for pago nesse tempo, o código vence e o horário volta a ficar livre para outra pessoa.`;
}

export function demoSteps(requiresPayerCpf: boolean): readonly string[] {
  return [
    "Escolhe o serviço e vê o valor do sinal antes de tudo.",
    "Escolhe o dia e um horário livre.",
    requiresPayerCpf
      ? "Informa nome, WhatsApp e CPF e lê a política do sinal antes de pagar."
      : "Informa nome e WhatsApp e lê a política do sinal antes de pagar.",
    "Copia o código Pix, paga no banco e recebe a confirmação.",
  ];
}

export type FaqItem = { id: string; question: string; answer: string };

const refundAnswer =
  "Você escolhe a regra de cada serviço: até quando o cliente pode cancelar ou remarcar e o que acontece se ele faltar. Ele lê essa regra antes de pagar e ela aparece no comprovante. Se a regra manda devolver, você devolve pelo AgendaPix. O botão Devolver pelo AgendaPix, no painel, abre uma confirmação. O valor sai do saldo da sua conta Mercado Pago. Pix pago depois do prazo para reservar o horário é devolvido sozinho, o valor inteiro, e você recebe um e-mail.";

/** A copy não lê pixRecipientDisplayName: na landing ele vem null. */
export function faqItems(facts: PublicBookingFacts): FaqItem[] {
  const items: FaqItem[] = [
    {
      id: "hold_time",
      question: "Quanto tempo o cliente tem para pagar o sinal?",
      answer: holdAnswer(facts.holdMinutes),
    },
    {
      id: "where_money",
      question: "Para onde vai o dinheiro do sinal?",
      answer: "O sinal cai direto na sua conta Mercado Pago, a que você conecta no AgendaPix. A reserva confirma sozinha, sem comprovante.",
    },
    {
      id: "cancel_noshow",
      question: "E se o cliente cancelar ou faltar?",
      answer: refundAnswer,
    },
    {
      id: "after_trial",
      question: "O que acontece depois dos 7 dias?",
      answer: "Se você assinar, tudo continua igual. Se não assinar, sua página continua no ar, mas os novos agendamentos pausam. Quem já agendou continua com o horário garantido.",
    },
    {
      id: "card",
      question: "Preciso de cartão de crédito para testar?",
      answer: "Não. Você cria sua agenda e usa por 7 dias sem cadastrar cartão.",
    },
    {
      id: "app",
      question: "Meu cliente precisa baixar aplicativo?",
      answer: "Não. Ele agenda pelo navegador do celular, a partir do seu link. Não precisa baixar nada nem criar conta.",
    },
    {
      id: "change_link",
      question: "Posso mudar meu link depois?",
      answer: "Por enquanto, não pelo painel. Escolha com calma no cadastro. Se precisar trocar, fale com a gente.",
    },
  ];

  if (facts.requiresPayerCpf) {
    items.push({
      id: "cpf",
      question: "Por que o cliente informa o CPF?",
      answer: "O Mercado Pago pede o CPF de quem paga para gerar o Pix. O AgendaPix envia o CPF direto para o Mercado Pago e não guarda esse dado, nem no banco nem no navegador.",
    });
  }

  return items;
}
