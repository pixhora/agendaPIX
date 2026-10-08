/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import { cn } from "@/lib/utils";
import { formatRollingValue, type RollingFormat } from "@/components/motion/rolling-format";
import { RollingNumberMotion } from "@/components/motion/rolling-number-motion";

export type RollingNumberProps = {
  /** Inteiro vindo do servidor. Em `currency`, são centavos. */
  value: number;
  format?: RollingFormat;
  /** Texto depois do número, por exemplo " minutos". */
  suffix?: string;
  className?: string;
  id?: string;
};

/** O texto final entra no HTML no servidor. O rolê no cliente é só um reforço. */
export function RollingNumber({ value, format = "integer", suffix = "", className, id }: RollingNumberProps) {
  const text = formatRollingValue(value, format, suffix);
  return (
    <span className={cn("relative inline-flex items-baseline tabular-nums leading-none", className)}>
      <span id={id} className="sr-only">{text}</span>
      <RollingNumberMotion text={text} />
    </span>
  );
}
