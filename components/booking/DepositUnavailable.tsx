"use client";

import { useEffect, useRef } from "react";
import { CalendarX2, Info, MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { whatsAppHref } from "./deposit-availability";

export function DepositUnavailableCard({
  businessName,
  phone,
  autoFocus = false,
}: {
  businessName: string;
  phone?: string | null;
  autoFocus?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const href = whatsAppHref(phone);
  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);
  return (
    <section role="status" className="rounded-frame border border-line bg-surface px-6 py-8 text-center">
      <span aria-hidden="true" className="mx-auto grid size-[52px] place-items-center rounded-2xl bg-subtle text-muted">
        <CalendarX2 className="size-[22px]" />
      </span>
      <h2 ref={titleRef} tabIndex={-1} className="mx-auto mt-4 max-w-[20ch] font-display text-2xl font-extrabold tracking-tight outline-none">
        Agendamento online indisponível no momento
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        {businessName} não está recebendo agendamentos online agora. Fale direto pelo WhatsApp.
      </p>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full")}>
          <MessageCircle aria-hidden="true" />
          Chamar no WhatsApp
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      ) : (
        <p className="mt-4 text-sm text-muted">Tente de novo mais tarde.</p>
      )}
    </section>
  );
}

export function DepositUnavailableLine() {
  return (
    <span className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-muted">
      <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      Agendamento online indisponível no momento.
    </span>
  );
}
