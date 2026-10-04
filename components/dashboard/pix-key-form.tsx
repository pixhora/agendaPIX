"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type PixKeyStatus = { configured: boolean; type: "cpf" | "cnpj" | "email" | "phone" | "evp" | null; hint: string | null };
type PixKeyType = NonNullable<PixKeyStatus["type"]>;
const pixTypeLabels: Record<PixKeyType, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", evp: "Chave aleatória" };
const control = "min-h-11 w-full rounded-md border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function PixKeyForm({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<PixKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const endpoint = `/api/businesses/${encodeURIComponent(businessId)}/pix-key`;

  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a chave Pix. Atualize a página para tentar novamente.");
        return response.json() as Promise<PixKeyStatus>;
      })
      .then((data) => { if (active) setStatus(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a chave Pix."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = inputRef.current;
    const type = typeRef.current?.value;
    const value = input?.value.trim();
    if (!input || !type || !value) { input?.focus(); return; }
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, value }) });
      const result = await response.json() as PixKeyStatus | { error?: { message?: string } };
      if (!response.ok) throw new Error("error" in result ? result.error?.message ?? "Não foi possível salvar a chave Pix." : "Não foi possível salvar a chave Pix.");
      setStatus(result as PixKeyStatus); setNotice("Chave Pix salva com segurança.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a chave Pix.");
    } finally {
      if (input) input.value = "";
      setPending(false);
    }
  }

  async function remove() {
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "DELETE", credentials: "same-origin" });
      const result = await response.json() as PixKeyStatus | { error?: { message?: string } };
      if (!response.ok) throw new Error("error" in result ? result.error?.message ?? "Não foi possível remover a chave Pix." : "Não foi possível remover a chave Pix.");
      setStatus(result as PixKeyStatus); setNotice("Chave Pix removida."); setRemoveConfirm(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover a chave Pix.");
    } finally { setPending(false); }
  }

  return <section className="rounded-xl border border-border bg-background p-4 sm:p-6" aria-labelledby="pix-key-title">
    <div className="mb-5 border-b border-border pb-4"><h2 id="pix-key-title" className="text-lg font-semibold">Chave Pix do negócio</h2><p className="mt-1 text-sm text-muted-foreground">A chave fica protegida no servidor. Ela não é exibida depois de salva.</p></div>
    {loading ? <p role="status" className="text-sm text-muted-foreground">Carregando configuração Pix…</p> : <>
      {error && <p role="alert" className="mb-4 rounded-md border-l-2 border-destructive bg-muted p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-md border-l-2 border-primary bg-muted p-3 text-sm">{notice}</p>}
      {status?.configured && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm"><span>{status.type ? pixTypeLabels[status.type] : "Pix"}: <strong>{status.hint}</strong></span>{removeConfirm ? <span className="flex flex-wrap gap-2"><span className="self-center">Remover esta chave?</span><Button type="button" variant="outline" disabled={pending} onClick={() => setRemoveConfirm(false)}>Manter chave</Button><Button type="button" variant="outline" disabled={pending} onClick={remove}>{pending ? "Removendo…" : "Confirmar remoção"}</Button></span> : <Button type="button" variant="outline" disabled={pending} onClick={() => setRemoveConfirm(true)}>Remover</Button>}</div>}
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end" aria-label="Configurar chave Pix">
        <label className="grid gap-2" htmlFor="pix-key-type">Tipo de chave<select ref={typeRef} className={control} id="pix-key-type" name="type" defaultValue={status?.type ?? "cpf"} disabled={pending}><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="evp">Chave aleatória</option></select></label>
        <label className="grid gap-2" htmlFor="pix-key-value">{status?.configured ? "Nova chave Pix" : "Chave Pix"}<input ref={inputRef} className={control} id="pix-key-value" name="value" type="password" autoComplete="off" spellCheck={false} maxLength={100} required disabled={pending} placeholder={status?.configured ? "Digite para substituir" : "Digite a chave Pix"} /></label>
        <Button type="submit" disabled={pending || loading} className="w-full sm:w-auto">{pending ? "Salvando…" : status?.configured ? "Substituir chave" : "Salvar chave"}</Button>
      </form>
    </>}
  </section>;
}
