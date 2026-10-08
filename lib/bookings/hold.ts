/** Serviço com sinal só oferece horário que começa depois da janela inteira do hold. */
export function depositSlotAllowed(startsAt: Date, now: Date, holdMinutes: number) {
  return startsAt.getTime() >= now.getTime() + holdMinutes * 60_000;
}
