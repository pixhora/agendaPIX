"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

type PixKeyStatus = { configured: boolean; type: "cpf" | "cnpj" | "email" | "phone" | "evp" | null; hint: string | null };
type PixKeyType = NonNullable<PixKeyStatus["type"]>;

const pixTypeLabels: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  evp: "Chave aleatória",
};

/**
 * The old payout key is not how money arrives anymore.
 * A saved key stays visible only so the owner can see that it is inactive.
 */
export function PixKeyForm({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<PixKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const endpoint = `/api/businesses/${encodeURIComponent(businessId)}/pix-key`;

  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a chave antiga.");
        return response.json() as Promise<PixKeyStatus>;
      })
      .then((data) => { if (active) setStatus(data); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a chave antiga.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint]);

  if (loading) {
    return <p role="status" className="text-sm text-muted">Carregando…</p>;
  }
  if (error) {
    return <p role="alert" className="text-sm font-medium text-danger">{error}</p>;
  }
  if (!status?.configured) return null;

  const typeLabel = status.type ? pixTypeLabels[status.type] : "Pix";
  return (
    <section className="rounded-card border border-line bg-surface" aria-labelledby="pix-key-title">
      <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="pix-key-title" className="font-display text-lg font-bold tracking-tight">Chave Pix antiga</h2>
          <p className="mt-1 text-sm font-semibold text-muted">Inativa. Esta chave não recebe os sinais.</p>
          <p className="mt-2 text-sm text-muted">
            {typeLabel}: <strong className="tabular-nums text-ink">{status.hint}</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
