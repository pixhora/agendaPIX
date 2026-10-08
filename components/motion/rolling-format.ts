export type RollingFormat = "currency" | "integer";

export type RollingPart =
  | { type: "digit"; digit: number }
  | { type: "mark"; char: string };

/** `currency` recebe centavos. `integer` imprime o número e o sufixo, em pt-BR. */
export function formatRollingValue(value: number, format: RollingFormat, suffix = ""): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (format === "currency") {
    const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.round(safe) / 100);
    return suffix ? `${formatted}${suffix}` : formatted;
  }
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(safe));
  return `${formatted}${suffix}`;
}

export function splitRollingText(text: string): RollingPart[] {
  return [...text].map((char) => {
    if (char >= "0" && char <= "9") return { type: "digit", digit: Number(char) };
    return { type: "mark", char };
  });
}

/** Lê `560ms` ou `.56s` (o build do Tailwind encurta a unidade). */
export function cssDurationMs(value: string, fallback = 560): number {
  const match = /^\s*([\d.]+)\s*(ms|s)?\s*$/.exec(value);
  if (!match) return fallback;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return fallback;
  return match[2] === "s" ? amount * 1000 : amount;
}
