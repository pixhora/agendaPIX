"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type PixKeyStatus = { configured: boolean; type: "cpf" | "cnpj" | "email" | "phone" | "evp" | null; hint: string | null };
type PixKeyType = NonNullable<PixKeyStatus["type"]>;
const pixTypeLabels: Record<PixKeyType, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", evp: "Chave aleatória" };

export function PixKeyForm({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<PixKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!pending && error) errorRef.current?.focus();
    if (!pending && notice === "Chave Pix removida.") inputRef.current?.focus();
  }, [pending, loading, error, notice]);
  const typeRef = useRef<HTMLSelectElement>(null);
  const endpoint = `/api/businesses/${encodeURIComponent(businessId)}/pix-key`;

  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store", credentials: "include" })
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
      const response = await fetch(endpoint, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, value }) });
      const result = await response.json() as PixKeyStatus | { error?: { message?: string } };
      if (!response.ok) throw new Error("error" in result ? result.error?.message ?? "Não foi possível salvar a chave Pix." : "Não foi possível salvar a chave Pix.");
      setStatus(result as PixKeyStatus); setNotice("Chave Pix salva com segurança."); toast.success("Chave Pix salva com segurança.");
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
      const response = await fetch(endpoint, { method: "DELETE", credentials: "include" });
      const result = await response.json() as PixKeyStatus | { error?: { message?: string } };
      if (!response.ok) throw new Error("error" in result ? result.error?.message ?? "Não foi possível remover a chave Pix." : "Não foi possível remover a chave Pix.");
      setStatus(result as PixKeyStatus); setNotice("Chave Pix removida."); setRemoveConfirm(false); toast.success("Chave Pix removida.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover a chave Pix.");
    } finally { setPending(false); }
  }

  return <section className="rounded-card border border-line bg-surface" aria-labelledby="pix-key-title" aria-busy={pending || loading}>
    <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pix-soft text-pix"><KeyRound className="size-4" /></span>
      <div><h2 id="pix-key-title" className="font-display text-lg font-bold tracking-tight">Chave Pix do negócio</h2><p className="mt-0.5 text-sm text-muted">A chave fica criptografada no servidor e não é exibida depois de salva.</p></div>
    </div>
    <div className="p-5 sm:p-6">
    {loading ? <p role="status" className="text-sm text-muted">Carregando configuração Pix…</p> : <>
      <div aria-live="polite" className="mb-4 empty:hidden">{pending ? <p role="status" className="text-sm text-muted">Atualizando configuração Pix…</p> : error ? <p ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-field border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</p> : notice ? <p role="status" aria-atomic="true" className="flex items-center gap-2 rounded-field border border-success/25 bg-success-soft p-3 text-sm font-medium text-success"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />{notice}</p> : null}</div>
      {status && !status.configured && <p className="mb-4 rounded-field border border-dashed border-warning/40 bg-warning-soft p-3 text-sm text-warning">Nenhuma chave Pix configurada. Escolha o tipo e salve a chave do seu negócio.</p>}
      {status?.configured && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-field border border-line bg-subtle p-3 text-sm"><span className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 text-success" />{status.type ? pixTypeLabels[status.type] : "Pix"}: <strong className="tabular-nums">{status.hint}</strong></span>{removeConfirm ? <span className="flex flex-wrap gap-2"><span className="self-center">Remover esta chave?</span><Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setRemoveConfirm(false)}>Manter chave</Button><Button type="button" size="sm" variant="danger" disabled={pending} onClick={remove}>{pending ? "Removendo…" : "Confirmar remoção"}</Button></span> : <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setRemoveConfirm(true)}>Remover</Button>}</div>}
      <form onChange={() => setNotice("")} onSubmit={save} className="grid gap-4 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end" aria-label="Configurar chave Pix">
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="pix-key-type">Tipo de chave<Select ref={typeRef} id="pix-key-type" name="type" defaultValue={status?.type ?? "cpf"} disabled={pending}><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="evp">Chave aleatória</option></Select></label>
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="pix-key-value">{status?.configured ? "Nova chave Pix" : "Chave Pix"}<Input ref={inputRef} id="pix-key-value" name="value" type="password" autoComplete="off" spellCheck={false} maxLength={100} required disabled={pending} placeholder={status?.configured ? "Digite para substituir" : "Digite a chave Pix"} /></label>
        <Button type="submit" variant="pix" disabled={pending || loading} className="w-full sm:w-auto">{pending ? "Salvando…" : status?.configured ? "Substituir chave" : "Salvar chave"}</Button>
      </form>
    </>}
    </div>
  </section>;
}
