import { formatDateFull, formatTimeSlot } from "./formatters";

interface ReservedTimeBandProps {
  startsAt: string;
  timezone: string;
  /** Faixa de confirmação depois que o sinal cai. Antes disso, o horário só está reservado. */
  paid?: boolean;
}

/** Faixa do horário reservado (`--pix-bright` com texto `--slab`, que permanece escuro nos dois modos). */
export function ReservedTimeBand({ startsAt, timezone, paid = false }: ReservedTimeBandProps) {
  const time = formatTimeSlot(startsAt, timezone);
  const date = formatDateFull(startsAt, timezone);
  const badge = paid ? "Reservado · sinal pago" : "Horário reservado";
  return (
    <div data-testid="reserved-band" className="rounded-card bg-pix-bright px-4 py-3 text-slab">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-2xl font-extrabold leading-none tabular-nums">{time}</span>
        <p className="shrink-0 whitespace-nowrap text-right text-sm font-bold leading-none">{badge}</p>
      </div>
      <p className="mt-1 text-xs font-semibold leading-snug first-letter:uppercase">{date}</p>
    </div>
  );
}
