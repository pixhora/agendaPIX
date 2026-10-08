/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import { cn } from "@/lib/utils";

export type CountdownTone = "normal" | "warn" | "expired";

export type CountdownRingProps = {
  secondsLeft: number;
  totalSeconds: number;
  tone: CountdownTone;
  label?: string;
  className?: string;
};

const SIZE = 88;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

export function formatClock(secondsLeft: number): string {
  const safe = Number.isFinite(secondsLeft) ? Math.max(0, Math.floor(secondsLeft)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ringGeometry(secondsLeft: number, totalSeconds: number, radius = RADIUS) {
  const circumference = 2 * Math.PI * radius;
  const safeTotal = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  const safeLeft = Number.isFinite(secondsLeft) ? Math.max(0, secondsLeft) : 0;
  const ratio = safeTotal === 0 ? 0 : Math.min(1, safeLeft / safeTotal);
  return { circumference, ratio, dash: circumference * ratio };
}

const toneClass: Record<CountdownTone, string> = {
  normal: "text-pix",
  warn: "text-warning",
  expired: "text-danger",
};

/** Anel estático. Quem chama informa os segundos; aqui não há relógio interno. */
export function CountdownRing({ secondsLeft, totalSeconds, tone, label, className }: CountdownRingProps) {
  const clock = formatClock(secondsLeft);
  const { circumference, dash } = ringGeometry(secondsLeft, totalSeconds);
  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)} data-tone={tone}>
      <div className="relative inline-grid">
        <svg
          aria-hidden="true"
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={toneClass[tone]}
        >
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        </svg>
        <p className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold tabular-nums text-ink">{clock}</p>
      </div>
      {label ? <p className="max-w-40 text-center text-sm text-muted">{label}</p> : null}
    </div>
  );
}
