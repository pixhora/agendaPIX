"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldShell, Input } from "@/components/ui/input";
import { moneyFigureClass } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { saveHours, saveService, saveWhatsapp } from "@/app/(product)/dashboard/(owner)/actions";
import { formatMoneyInput, parseMoney, type FormState } from "@/lib/dashboard/validation";
import { depositPolicySchema, PADRAO_DEPOSIT_POLICY, type DepositPolicy } from "@/lib/policy/schema";
import { policyPreviewCopy } from "@/lib/dashboard/policy-preview";
import {
  futureBookingsWarning,
  initialPolicyForm,
  patchPolicy,
  policiesMatch,
  selectPreset,
  setChargeDeposit,
  type PolicyFormState,
  type PresetChoice,
} from "@/lib/dashboard/policy-form";
import { PolicyEditor } from "@/components/policy/policy-editor";
import { ServiceImageUpload } from "@/components/dashboard/service-image-upload";
import { cn } from "@/lib/utils";

export const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const labelClass = "grid gap-1.5 text-sm font-semibold";
// O Input já traz o próprio invólucro com borda; aqui o invólucro vem do FieldShell, então o interno fica sem visual.
const bareInput = "border-0 bg-transparent shadow-none outline-none focus-visible:border-transparent focus-visible:shadow-none";
const bareShell = "min-h-0 border-0 bg-transparent shadow-none focus-within:border-transparent focus-within:shadow-none has-[[aria-invalid=true]]:border-0 has-[:disabled]:border-0 has-[:disabled]:bg-transparent";
const countSchema = z.object({ count: z.number().int().nonnegative() });

type FutureStatus = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; count: number } | { kind: "error" };

function Feedback({ state, showSuccess }: { state: FormState; showSuccess: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) ref.current?.focus();
    if (state.success) toast.success(state.success);
  }, [state]);
  return <>
    {state.error && <p ref={ref} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-field border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{state.error}</p>}
    {showSuccess && state.success && <p role="status" aria-atomic="true" className="flex items-center gap-2 rounded-field border border-success/25 bg-success-soft p-3 text-sm font-medium text-success"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />{state.success}</p>}
  </>;
}

function PendingLine({ children }: { children: string }) {
  return <p role="status" aria-busy="true" className="flex items-center gap-2 text-sm text-muted"><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />{children}</p>;
}

function FormCta({ pending, idle, offline = false }: { pending: boolean; idle: string; offline?: boolean }) {
  // Sem internet o botão fica parado, sem dizer "Salvando…": o aviso de "Sem internet" aparece ao lado.
  return (
    <Button type="submit" disabled={pending || offline} aria-busy={pending} className="dash-disabled w-full md:w-auto">
      {pending ? <><Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />Salvando…</> : idle}
    </Button>
  );
}

function FieldShell({ invalid, children }: { invalid?: boolean; children: React.ReactNode }) {
  return <span className="control-shell block rounded-field border border-line-strong/60 bg-surface" data-invalid={invalid ? "true" : undefined}>{children}</span>;
}

function MoneyInput({ id, invalid, className, value, disabled, readOnly, ...props }: React.ComponentProps<"input"> & { id: string; invalid?: boolean }) {
  const empty = value == null || value === "";
  const quiet = Boolean(disabled || readOnly);
  return (
    <div className={cn(fieldShell, "gap-1 px-3.5", quiet && "border-line bg-subtle shadow-none")}>
      <span aria-hidden="true" data-money-prefix="" className={cn(moneyFigureClass, "pointer-events-none shrink-0", quiet || empty ? "text-muted" : "text-ink")}>R$</span>
      <input
        id={id}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        pattern="(?:\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)"
        className={cn(moneyFigureClass, "dash-disabled min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:text-muted", quiet && "text-muted", className)}
        {...props}
      />
    </div>
  );
}

function TextInput({ invalid, className, ...props }: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return <FieldShell invalid={invalid}><Input shellClassName={bareShell} aria-invalid={invalid || undefined} className={cn(bareInput, "dash-disabled", className)} {...props} /></FieldShell>;
}

type Service = { id: string; name: string; durationMinutes: number; priceCents: number; depositCents: number; active: boolean; depositPolicy?: DepositPolicy; imageUrl?: string | null };
const initialValues = (service?: Service) => ({ name: service?.name ?? "", duration: String(service?.durationMinutes ?? 30), price: service ? formatMoneyInput(service.priceCents) : "", deposit: service ? formatMoneyInput(service.depositCents) : "0,00", active: service?.active ?? true });

function centsFromInput(value: string) {
  try {
    return parseMoney(value);
  } catch {
    return 0;
  }
}

export function ServiceForm({ businessId, businessName, contactWhatsapp = null, service, futureBookingsCount }: {
  businessId: string;
  businessName: string;
  contactWhatsapp?: string | null;
  service?: Service;
  /** Número fixo para prévia. Sem ele, o formulário consulta as reservas futuras. */
  futureBookingsCount?: number;
}) {
  const [state, action, pending] = useActionState(saveService, {});
  const [showSuccess, setShowSuccess] = useState(true);
  const [clientError, setClientError] = useState("");
  const [online, setOnline] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const prefix = service?.id ?? "new";
  const [values, setValues] = useState(() => initialValues(service));
  const [imageUrl, setImageUrl] = useState<string | null>(service?.imageUrl ?? null);
  const [policyState, setPolicyState] = useState<PolicyFormState>(() => initialPolicyForm(service));
  const requestKey = service && futureBookingsCount === undefined ? `${service.id}:${attempt}` : "";
  const [trackedKey, setTrackedKey] = useState(requestKey);
  const [future, setFuture] = useState<FutureStatus>(() => futureBookingsCount !== undefined ? { kind: "ready", count: futureBookingsCount } : service ? { kind: "loading" } : { kind: "idle" });
  if (trackedKey !== requestKey) {
    setTrackedKey(requestKey);
    setFuture(requestKey ? { kind: "loading" } : futureBookingsCount !== undefined ? { kind: "ready", count: futureBookingsCount } : { kind: "idle" });
  }
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const allowSave = useRef(false);
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.success && !service) {
      setValues(initialValues());
      setPolicyState(initialPolicyForm());
    }
  }

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    const serviceId = service?.id;
    if (!serviceId || futureBookingsCount !== undefined) return;
    const controller = new AbortController();
    let active = true;
    fetch(`/api/businesses/${encodeURIComponent(businessId)}/services/${encodeURIComponent(serviceId)}/future-bookings-count`, { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        const parsed = countSchema.safeParse(body);
        if (!response.ok || !parsed.success) throw new Error("count");
        if (active) setFuture({ kind: "ready", count: parsed.data.count });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (active) setFuture({ kind: "error" });
      });
    return () => { active = false; controller.abort(); };
  }, [attempt, businessId, futureBookingsCount, service?.id]); // service entra só pelo id

  const depositCents = policyState.chargeDeposit ? centsFromInput(values.deposit) : 0;
  const priceCents = centsFromInput(values.price);
  const depositInvalid = depositCents > priceCents;
  const savedPolicy = service?.depositPolicy && depositPolicySchema.safeParse(service.depositPolicy).success ? service.depositPolicy : PADRAO_DEPOSIT_POLICY;
  const policyChanged = service ? !policiesMatch(policyState.policy, savedPolicy) : false;
  const futureWarning = future.kind === "ready" ? futureBookingsWarning(future.count) : null;

  function customize(patch: Partial<Pick<DepositPolicy, "refundUntilHours" | "rescheduleUntilHours" | "lateCancel" | "noShow">>) {
    const next = patchPolicy(policyState, patch);
    if (next.error) setClientError(next.error);
    else { setClientError(""); setPolicyState(next.state); }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    setShowSuccess(true);
    if (!online) {
      event.preventDefault();
      setClientError("Sem internet. Suas mudanças não foram salvas.");
      return;
    }
    if (depositInvalid) {
      event.preventDefault();
      setClientError("O sinal não pode ser maior que o preço.");
      return;
    }
    const parsed = depositPolicySchema.safeParse(policyState.policy);
    if (!parsed.success) {
      event.preventDefault();
      setClientError(parsed.error.issues[0]?.message ?? "Confira a política do sinal.");
      return;
    }
    if (service && policyChanged && !allowSave.current) {
      if (future.kind === "loading") {
        event.preventDefault();
        setClientError("Ainda estamos conferindo as reservas futuras…");
        return;
      }
      if (future.kind === "error") {
        event.preventDefault();
        setClientError("Não foi possível conferir as reservas futuras. Tente de novo antes de salvar a política.");
        return;
      }
      if (future.kind === "ready" && future.count > 0) {
        event.preventDefault();
        dialogRef.current?.showModal();
      }
    }
    allowSave.current = false;
  }

  return <form ref={formRef} action={action} onChange={() => setShowSuccess(false)} onSubmit={onSubmit} className="grid min-w-0 gap-4" aria-busy={pending} aria-label={service ? `Editar ${service.name}` : "Cadastrar serviço"}>
    <input type="hidden" name="businessId" value={businessId} />
    <input type="hidden" name="depositPolicy" value={JSON.stringify(policyState.policy)} />
    {service && <input type="hidden" name="id" value={service.id} />}
    <label htmlFor={`${prefix}-name`} className={labelClass}>Nome do serviço
      <TextInput id={`${prefix}-name`} name="name" required maxLength={120} placeholder="Ex.: Corte masculino" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
    </label>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label htmlFor={`${prefix}-duration`} className={cn(labelClass, "min-w-0 sm:col-span-2")}>Duração (minutos)
        <TextInput id={`${prefix}-duration`} name="durationMinutes" type="number" min={1} max={1440} required className="tabular-nums" value={values.duration} onChange={(event) => setValues({ ...values, duration: event.target.value })} />
      </label>
      <label htmlFor={`${prefix}-price`} className={cn(labelClass, "min-w-0 content-start")}>Preço
        <MoneyInput id={`${prefix}-price`} name="price" required placeholder="0,00" value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} />
      </label>
      {policyState.chargeDeposit
        ? <label htmlFor={`${prefix}-deposit`} className={cn(labelClass, "min-w-0 content-start")}>Sinal via Pix<MoneyInput id={`${prefix}-deposit`} name="deposit" required invalid={depositInvalid} aria-describedby={depositInvalid ? `${prefix}-deposit-error` : undefined} value={values.deposit} onChange={(event) => setValues({ ...values, deposit: event.target.value })} /></label>
        : <input type="hidden" name="deposit" value="0,00" />}
      <label className="flex min-h-11 items-center justify-between gap-2 text-sm font-semibold sm:col-span-2">
        Cobrar sinal no Pix
        <span className="control-shell inline-flex rounded-full border border-transparent">
          <Switch className="dash-disabled" checked={policyState.chargeDeposit} onChange={(event) => setPolicyState(setChargeDeposit(policyState, event.target.checked))} />
        </span>
      </label>
    </div>
    {depositInvalid && <p id={`${prefix}-deposit-error`} role="alert" className="text-sm font-medium text-danger">O sinal não pode ser maior que o preço.</p>}
    {!depositInvalid && <p className="text-sm text-muted">O sinal deve ser menor ou igual ao preço. Sinal zero confirma o horário sem cobrança.</p>}
    {service
      ? <ServiceImageUpload businessId={businessId} serviceId={service.id} url={imageUrl} onChangeUrl={setImageUrl} />
      : <p className="text-sm text-muted">Salve o serviço para adicionar uma foto.</p>}
    {policyState.chargeDeposit && depositCents > 0 ? <PolicyEditor
      idPrefix={prefix}
      businessName={businessName}
      contactWhatsapp={contactWhatsapp}
      depositCents={depositCents}
      policy={policyState.policy}
      onPreset={(preset: PresetChoice) => { setClientError(""); setPolicyState(selectPreset(policyState, preset)); }}
      onCustom={customize}
    /> : <p aria-live="polite" className="rounded-card bg-pix-soft p-4 text-sm text-ink">{policyPreviewCopy(policyState.policy, businessName, 0, contactWhatsapp).summary}</p>}
    {service && future.kind === "loading" && <PendingLine>Conferindo reservas futuras…</PendingLine>}
    {futureWarning && <p role="status" className="flex items-start gap-2 rounded-field border border-warning/30 bg-warning-soft p-3 text-sm text-ink"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />{futureWarning}</p>}
    {service && future.kind === "error" && <p role="alert" className="text-sm text-danger">Não foi possível conferir as reservas futuras. <button type="button" className="inline-flex min-h-11 items-center font-semibold underline" onClick={() => setAttempt((value) => value + 1)}>Tentar de novo</button></p>}
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
      <span className="control-shell inline-flex rounded-full border border-transparent"><Switch className="dash-disabled" name="active" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} /></span>
      Disponível para agendamento
    </label>
    {!online && <p role="alert" className="text-sm font-medium text-danger">Sem internet. Suas mudanças não foram salvas.</p>}
    {clientError && <p role="alert" className="text-sm font-medium text-danger">{clientError}</p>}
    <div aria-live="polite" className="empty:hidden">{pending ? <PendingLine>Salvando…</PendingLine> : <Feedback state={state} showSuccess={showSuccess} />}</div>
    <FormCta pending={pending} offline={!online} idle={service ? "Salvar serviço" : "Cadastrar serviço"} />
    <dialog ref={dialogRef} aria-labelledby={`${prefix}-future-title`} className="m-auto w-[min(calc(100%-2rem),28rem)] rounded-card border border-line bg-surface p-5 text-ink backdrop:bg-ink/50">
      <h2 id={`${prefix}-future-title`} className="font-display text-lg font-bold">Reservas já feitas</h2>
      <p className="mt-2 text-sm leading-relaxed">{futureWarning}</p>
      <div className="mt-4 grid gap-2 sm:flex">
        <Button type="button" className="w-full sm:w-auto" onClick={() => { allowSave.current = true; dialogRef.current?.close(); formRef.current?.requestSubmit(); }}>Salvar nova regra</Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => dialogRef.current?.close()}>Cancelar</Button>
      </div>
    </dialog>
  </form>;
}

export function WhatsappForm({ businessId, contactWhatsapp }: { businessId: string; contactWhatsapp: string | null }) {
  const [state, action, pending] = useActionState(saveWhatsapp, {});
  const [showSuccess, setShowSuccess] = useState(true);
  return <form action={action} onChange={() => setShowSuccess(false)} onSubmit={() => setShowSuccess(true)} className="grid gap-4" aria-busy={pending}>
    <input type="hidden" name="businessId" value={businessId} />
    <label htmlFor="contact-whatsapp" className={labelClass}>WhatsApp do negócio
      <TextInput id="contact-whatsapp" name="contactWhatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+55 11 99999-9999" defaultValue={contactWhatsapp ?? ""} invalid={Boolean(state.error)} aria-describedby="contact-whatsapp-hint" />
    </label>
    <p id="contact-whatsapp-hint" className="text-sm text-muted">Opcional. Seus clientes usam esse número para falar com você.</p>
    <div aria-live="polite" className="empty:hidden">{pending ? <PendingLine>Salvando…</PendingLine> : <Feedback state={state} showSuccess={showSuccess} />}</div>
    <FormCta pending={pending} idle="Salvar WhatsApp" />
  </form>;
}

export function HoursForm({ businessId, hours }: { businessId: string; hours: { weekday: number; opensAt: string; closesAt: string }[] }) {
  const [state, action, pending] = useActionState(saveHours, {});
  const [showSuccess, setShowSuccess] = useState(true);
  const [days, setDays] = useState(weekdays.map((_, weekday) => { const value = hours.find((hour) => hour.weekday === weekday); return { open: !!value, start: value?.opensAt.slice(0, 5) ?? "09:00", end: value?.closesAt.slice(0, 5) ?? "18:00" }; }));
  function changeDay(weekday: number, value: Partial<(typeof days)[number]>) { setDays(days.map((day, index) => index === weekday ? { ...day, ...value } : day)); }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return <form action={action} onChange={() => setShowSuccess(false)} onSubmit={() => setShowSuccess(true)} className="grid gap-4" aria-busy={pending} aria-label="Horários de funcionamento">
    <input type="hidden" name="businessId" value={businessId} />
    <div className="divide-y divide-line rounded-field border border-line">
      {order.map((weekday) => {
        const day = weekdays[weekday];
        const value = days[weekday];
        const invalid = value.open && value.start >= value.end;
        const errorId = `hours-error-${weekday}`;
        return <fieldset key={day} className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(8rem,10rem)_minmax(8rem,10rem)] sm:gap-4 sm:px-4">
          <legend className="sr-only">{day}</legend>
          <label className="col-span-2 flex min-h-11 items-center gap-3 sm:col-span-1">
            <span className="control-shell inline-flex rounded-full border border-transparent"><Switch className="dash-disabled" name={`open-${weekday}`} checked={value.open} onChange={(event) => changeDay(weekday, { open: event.target.checked })} aria-label={`${day}: aberto`} /></span>
            <span className="font-semibold">{day}</span>
            <span className={cn("ml-auto text-xs font-semibold sm:hidden", value.open ? "text-success" : "text-muted")}>{value.open ? "Aberto" : "Fechado"}</span>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted" htmlFor={`start-${weekday}`}>Abre às
            <TextInput className="tabular-nums" id={`start-${weekday}`} name={`start-${weekday}`} type="time" value={value.start} onChange={(event) => changeDay(weekday, { start: event.target.value })} disabled={!value.open} required invalid={invalid} aria-describedby={invalid ? errorId : undefined} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted" htmlFor={`end-${weekday}`}>Fecha às
            <TextInput className="tabular-nums" id={`end-${weekday}`} name={`end-${weekday}`} type="time" value={value.end} onChange={(event) => changeDay(weekday, { end: event.target.value })} disabled={!value.open} required invalid={invalid} aria-describedby={invalid ? errorId : undefined} />
          </label>
          {invalid && <p id={errorId} role="alert" className="col-span-2 text-sm font-medium text-danger">O fim precisa ser depois do início.</p>}
        </fieldset>;
      })}
    </div>
    <p className="text-sm text-muted">Desligue os dias sem atendimento. Cada dia aceita um intervalo.</p>
    {!days.some((day) => day.open) && <p role="status" className="rounded-field border border-warning/30 bg-warning-soft p-3 text-sm text-warning">Nenhum dia selecionado. Ao salvar, sua agenda ficará fechada para novos agendamentos.</p>}
    <div aria-live="polite" className="empty:hidden">{pending ? <PendingLine>Salvando…</PendingLine> : <Feedback state={state} showSuccess={showSuccess} />}</div>
    <FormCta pending={pending} idle="Salvar horários de funcionamento" />
  </form>;
}
