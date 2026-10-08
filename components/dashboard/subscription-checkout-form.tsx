"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SUBSCRIPTION_ALREADY_ACTIVE_COPY, subscriptionRaceMessage } from "@/lib/billing/checkout";

/** O envio nativo abre o WhatsApp. Se o back responder 409, a aba fecha e o aviso fica neste card. */
export function SubscriptionCheckoutForm({ action, children }: { action: string; children: ReactNode }) {
  const [race, setRace] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const popup = window.open("", "agendapix-subscription-checkout");
    if (!popup) return;
    event.preventDefault();
    setRace(null);
    form.target = popup.name || "agendapix-subscription-checkout";
    form.submit();
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      if (popup.closed || Date.now() - started > 8000) {
        if (timerRef.current != null) window.clearInterval(timerRef.current);
        return;
      }
      let text = "";
      try {
        text = popup.document.body?.innerText ?? "";
      } catch {
        if (timerRef.current != null) window.clearInterval(timerRef.current);
        return;
      }
      const message = subscriptionRaceMessage(text);
      if (!message) return;
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      popup.close();
      setRace(message || SUBSCRIPTION_ALREADY_ACTIVE_COPY);
    }, 200);
  }

  return (
    <div className="grid w-full gap-2 sm:w-auto">
      <form method="post" action={action} target="_blank" rel="noopener" onSubmit={onSubmit} className="w-full sm:w-auto">
        {children}
      </form>
      {race && <p role="status" className="max-w-[62ch] text-sm leading-relaxed">{race}</p>}
    </div>
  );
}
