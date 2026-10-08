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
  return (
    <div
      data-testid="reserved-band"
      className="flex min-h-11 items-center justify-between gap-3 rounded-card bg-pix-bright px-4 py-3 text-slab"
    >
      <p className="min-w-0">
        <span className="block font-display text-2xl font-extrabold leading-none tabular-nums">{time}</span>
        <span className="mt-1 block truncate text-xs font-semibold first-letter:uppercase">{date}</span>
      </p>
      <p className="max-w-[12rem] text-right text-sm font-bold leading-snug">
        {paid ? "Reservado · sinal pago" : "Horário reservado"}
      </p>
    </div>
  );
}
