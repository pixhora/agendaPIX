"use client";

import { useEffect, useRef } from "react";
import { OTP_LENGTH, otpDigits } from "@/lib/onboarding/otp";
import { cn } from "@/lib/utils";

export type OtpVisualStatus = "idle" | "loading" | "error" | "success";

export function OtpInput({
  id = "otp-code",
  value,
  onChange,
  onComplete,
  status = "idle",
  readOnly = false,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  status?: OtpVisualStatus;
  readOnly?: boolean;
  describedBy?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const completed = useRef("");

  useEffect(() => {
    if (status === "error") inputRef.current?.focus();
  }, [status]);

  function update(raw: string) {
    const next = otpDigits(raw);
    onChange(next);
    if (next.length < OTP_LENGTH) {
      completed.current = "";
      return;
    }
    if (completed.current === next) return;
    completed.current = next;
    onComplete?.(next);
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-6 gap-2 max-[359px]:gap-1.5" aria-hidden="true">
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const char = value[index] ?? "";
          const active = !readOnly && status !== "success" && value.length < OTP_LENGTH && index === value.length;
          const filled = char.length > 0;
          return (
            <div
              key={index}
              className={cn(
                "flex h-14 min-w-0 items-center justify-center rounded-xl border bg-surface font-display text-2xl font-bold tabular-nums max-[359px]:h-11",
                status === "error" && "border-danger",
                status === "success" && "border-success",
                status !== "error" && status !== "success" && filled && "border-ink",
                status !== "error" && status !== "success" && active && "border-2 border-ink",
                status !== "error" && status !== "success" && !filled && !active && "border-line-strong/60",
              )}
            >
              {char}
              {active ? <span className="ml-0.5 h-6 w-0.5 bg-ink motion-safe:animate-pulse" /> : null}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(event) => update(event.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        pattern="\d{6}"
        aria-label="Código de 6 dígitos"
        aria-invalid={status === "error" ? true : undefined}
        aria-describedby={describedBy}
        readOnly={readOnly}
        autoFocus
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
      />
    </div>
  );
}
