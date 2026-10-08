export const availableNow = [
  "Página de agendamento com o seu link",
  "Sinal por Pix com confirmação automática",
  "Vários serviços, cada um com seu sinal",
  "Painel com a agenda do dia e lista de clientes",
] as const;

export const comingSoon: readonly { label: string; completo?: string }[] = [
  { label: "Lembrete do horário no WhatsApp", completo: "Lembrete no WhatsApp do cliente" },
  { label: "Cancelar, remarcar e marcar falta pelo painel" },
  { label: "Folgas e bloqueios em datas específicas" },
  { label: "Relatório de sinais recebidos", completo: "Relatório de sinais recebidos" },
];

export const completoExtraFeatures = comingSoon.flatMap((item) => (item.completo ? [item.completo] : []));
