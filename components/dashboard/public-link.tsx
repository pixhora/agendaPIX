"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";

const subscribeNoop = () => () => {};

/** Link público do negócio com botão de copiar (feedback por toast + região viva). */
export function PublicLink({ slug }: { slug: string }) {
  const origin = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const url = `${origin}/${slug}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado. Cole no WhatsApp ou no Instagram.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }
  return <div className="grid gap-3">
    <div className="flex min-h-12 min-w-0 items-center rounded-field border border-line bg-subtle px-3.5 text-sm">
      <span className="truncate font-medium tabular-nums"><span className="text-muted">{origin.replace(/^https?:\/\//, "")}/</span>{slug}</span>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <Button type="button" variant="pix" onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copiado" : "Copiar link"}</Button>
      <a href={`/${slug}`} target="_blank" className={buttonVariants({ variant: "outline" })}><ExternalLink aria-hidden="true" />Abrir página<span className="sr-only"> (abre em nova aba)</span></a>
    </div>
    <p className="sr-only" aria-live="polite">{copied ? "Link copiado" : ""}</p>
  </div>;
}
