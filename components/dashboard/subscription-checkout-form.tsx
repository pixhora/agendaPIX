"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  SUBSCRIPTION_LOGIN_PATH,
  SUBSCRIPTION_UNAVAILABLE_COPY,
  subscriptionPostEffect,
} from "@/lib/dashboard/subscription-ui";

/** O envio nativo abre o WhatsApp. O JSON de erro fica nesta aba, decidido pelo `code`. */
export function SubscriptionCheckoutForm({ action, children, note }: { action: string; children: ReactNode; note?: ReactNode }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const popup = window.open("", "agendapix-subscription-checkout");
    if (!popup) return;
    event.preventDefault();
    setNotice(null);
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
      const effect = subscriptionPostEffect(text);
      if (!effect) return;
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      popup.close();
      if (effect.kind === "login") {
        window.location.assign(SUBSCRIPTION_LOGIN_PATH);
        return;
      }
      if (effect.kind === "unavailable") {
        setUnavailable(true);
        return;
      }
      setNotice(effect.text);
    }, 200);
  }

  if (unavailable) {
    return <p role="status" className="max-w-[62ch] text-sm leading-relaxed">{SUBSCRIPTION_UNAVAILABLE_COPY}</p>;
  }

  return (
    <div className="grid w-full gap-2 sm:w-auto">
      <form method="post" action={action} target="_blank" rel="noopener" onSubmit={onSubmit} className="w-full sm:w-auto">
        {children}
      </form>
      {notice && <p role="status" className="max-w-[62ch] text-sm leading-relaxed">{notice}</p>}
      {note}
    </div>
  );
}
