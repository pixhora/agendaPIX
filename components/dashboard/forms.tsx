"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveHours, saveService } from "@/app/dashboard/(owner)/actions";
import { dayError, draftsFromHours, hoursError, hoursPayload, MULTI_INTERVAL_HOURS, withPause, withoutPause, type DayDraft, type HourRange } from "@/lib/dashboard/hours-form";
import type { FormState } from "@/lib/dashboard/validation";
import { cn } from "@/lib/utils";

export const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const labelClass = "grid gap-1.5 text-sm font-semibold";

/** Feedback inline (acessível) + toast Sonner no sucesso. */
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

function MoneyInput({ id, ...props }: React.ComponentProps<"input"> & { id: string }) {
  return <span className="relative block">
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-muted">R$</span>
    <Input id={id} inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" className="pl-10 tabular-nums" {...props} />
  </span>;
}

type Service = { id: string; name: string; durationMinutes: number; priceCents: number; depositCents: number; active: boolean };
const initialValues = (service?: Service) => ({ name: service?.name ?? "", duration: String(service?.durationMinutes ?? 30), price: service ? (service.priceCents / 100).toFixed(2) : "", deposit: service ? (service.depositCents / 100).toFixed(2) : "0,00", active: service?.active ?? true });

export function ServiceForm({ businessId, service }: { businessId: string; service?: Service }) {
  const [state, action, pending] = useActionState(saveService, {});
  const [showSuccess, setShowSuccess] = useState(true);
  const prefix = service?.id ?? "new";
  const [values, setValues] = useState(() => initialValues(service));
  // Após cadastrar um serviço novo, limpa o formulário (ajuste de estado durante o render, sem efeito).
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.success && !service) setValues(initialValues());
  }
  return <form action={action} onChange={() => setShowSuccess(false)} onSubmit={() => setShowSuccess(true)} className="grid gap-4" aria-busy={pending} aria-label={service ? `Editar ${service.name}` : "Cadastrar serviço"}>
    <input type="hidden" name="businessId" value={businessId} />
    {service && <input type="hidden" name="id" value={service.id} />}
    <label htmlFor={`${prefix}-name`} className={labelClass}>Nome do serviço<Input id={`${prefix}-name`} name="name" required maxLength={120} placeholder="Ex.: Corte masculino" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
    <div className="grid grid-cols-2 gap-3">
      <label htmlFor={`${prefix}-duration`} className={cn(labelClass, "col-span-2")}>Duração (minutos)<Input id={`${prefix}-duration`} name="durationMinutes" type="number" min={1} max={1440} required className="tabular-nums" value={values.duration} onChange={(event) => setValues({ ...values, duration: event.target.value })} /></label>
      <label htmlFor={`${prefix}-price`} className={labelClass}>Preço<MoneyInput id={`${prefix}-price`} name="price" required placeholder="0,00" value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} /></label>
      <label htmlFor={`${prefix}-deposit`} className={labelClass}>Sinal via Pix<MoneyInput id={`${prefix}-deposit`} name="deposit" required value={values.deposit} onChange={(event) => setValues({ ...values, deposit: event.target.value })} /></label>
    </div>
    <p className="text-sm text-muted">O sinal deve ser menor ou igual ao preço. Sinal zero confirma o horário sem cobrança.</p>
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><Switch name="active" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} />Disponível para agendamento</label>
    <div aria-live="polite" className="empty:hidden">{pending ? <p role="status" className="text-sm text-muted">Salvando alterações…</p> : <Feedback state={state} showSuccess={showSuccess} />}</div>
    <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">{pending ? "Salvando serviço…" : service ? "Salvar serviço" : "Cadastrar serviço"}</Button>
  </form>;
}

const timeInputClass = "border-0 bg-transparent shadow-none outline-none hover:border-transparent focus-visible:border-transparent focus-visible:outline-none aria-invalid:border-0";
const shellClass = "control-shell block rounded-field border border-line-strong/60 bg-surface has-[[aria-invalid=true]]:border-danger";

export function HoursForm({ businessId, hours, multiInterval = MULTI_INTERVAL_HOURS }: { businessId: string; hours: HourRange[]; multiInterval?: boolean }) {
  const [state, action, pending] = useActionState(saveHours, {});
  const [showSuccess, setShowSuccess] = useState(true);
  const [clientError, setClientError] = useState("");
  const [days, setDays] = useState<DayDraft[]>(() => draftsFromHours(hours, multiInterval));
  function changeDay(weekday: number, value: Partial<DayDraft> | ((day: DayDraft) => DayDraft)) {
    setDays(days.map((day, index) => index === weekday ? (typeof value === "function" ? value(day) : { ...day, ...value }) : day));
    setClientError("");
    setShowSuccess(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    const error = hoursError(days, multiInterval);
    if (error) {
      event.preventDefault();
      setClientError(error);
      setShowSuccess(false);
      return;
    }
    setClientError("");
    setShowSuccess(true);
  }
  const payload = hoursPayload(days, multiInterval);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const feedback = clientError ? { error: clientError } : state;
  return <form action={action} onSubmit={submit} className="grid gap-4 pb-24 md:pb-0" aria-busy={pending} aria-label="Horários de funcionamento">
    <input type="hidden" name="businessId" value={businessId} />
    {multiInterval ? <input type="hidden" name="hoursJson" value={JSON.stringify(payload)} /> : order.map((weekday) => {
      const value = days[weekday];
      return value?.open ? <span key={weekday}>
        <input type="hidden" name={`open-${weekday}`} value="on" />
        <input type="hidden" name={`start-${weekday}`} value={value.start} />
        <input type="hidden" name={`end-${weekday}`} value={value.end} />
      </span> : null;
    })}
    <div className="divide-y divide-line rounded-field border border-line">
      {order.map((weekday) => {
        const day = weekdays[weekday];
        const value = days[weekday];
        const invalid = clientError !== "" && dayError(value, multiInterval) === clientError;
        return <fieldset key={day} className="grid min-w-0 gap-3 px-3 py-3 sm:px-4">
          <legend className="sr-only">{day}</legend>
          <div className="flex min-h-11 min-w-0 items-center gap-3">
            <Switch name={`open-visible-${weekday}`} checked={value.open} onChange={(event) => changeDay(weekday, { open: event.target.checked })} aria-label={`${day}: aberto`} disabled={pending} />
            <span className="font-semibold">{day}</span>
            <span className={cn("ml-auto text-xs font-semibold", value.open ? "text-success" : "text-muted")}>{value.open ? "Aberto" : "Fechado"}</span>
          </div>
          <div className={cn("grid min-w-0 grid-cols-2 gap-3", !value.open && "dash-disabled")}>
            <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted" htmlFor={`start-${weekday}`}>Abre às
              <span className={shellClass}><Input className={cn("tabular-nums", timeInputClass)} id={`start-${weekday}`} type="time" value={value.start} onChange={(event) => changeDay(weekday, { start: event.target.value })} disabled={!value.open || pending} required={value.open} aria-invalid={invalid || undefined} /></span>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted" htmlFor={`end-${weekday}`}>Fecha às
              <span className={shellClass}><Input className={cn("tabular-nums", timeInputClass)} id={`end-${weekday}`} type="time" value={value.end} onChange={(event) => changeDay(weekday, { end: event.target.value })} disabled={!value.open || pending} required={value.open} aria-invalid={invalid || undefined} /></span>
            </label>
          </div>
          {multiInterval && value.open && (value.pause ? <div className="grid min-w-0 gap-2">
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted" htmlFor={`pause-start-${weekday}`}>Pausa das
                <span className={shellClass}><Input className={cn("tabular-nums", timeInputClass)} id={`pause-start-${weekday}`} type="time" value={value.pause.start} onChange={(event) => changeDay(weekday, (current) => ({ ...current, pause: { start: event.target.value, end: current.pause?.end ?? "13:00" } }))} disabled={pending} aria-invalid={invalid || undefined} /></span>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted" htmlFor={`pause-end-${weekday}`}>até
                <span className={shellClass}><Input className={cn("tabular-nums", timeInputClass)} id={`pause-end-${weekday}`} type="time" value={value.pause.end} onChange={(event) => changeDay(weekday, (current) => ({ ...current, pause: { start: current.pause?.start ?? "12:00", end: event.target.value } }))} disabled={pending} aria-invalid={invalid || undefined} /></span>
              </label>
            </div>
            <button type="button" className="min-h-11 w-fit rounded-full px-2 text-sm font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => changeDay(weekday, withoutPause(value))}>Tirar pausa</button>
          </div> : <button type="button" className="min-h-11 w-fit rounded-full px-2 text-sm font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => changeDay(weekday, withPause(value))}>Adicionar pausa</button>)}
        </fieldset>;
      })}
    </div>
    <p className="text-sm text-muted">{multiInterval ? "Desligue os dias sem atendimento. Cada dia aceita uma pausa." : "Desligue os dias sem atendimento. Cada dia aceita um intervalo."}</p>
    {!days.some((day) => day.open) && <p role="status" className="rounded-field border border-warning/30 bg-warning-soft p-3 text-sm text-warning">Nenhum dia selecionado. Ao salvar, sua agenda ficará fechada para novos agendamentos.</p>}
    <div aria-live="polite" className="empty:hidden">{pending ? <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />Salvando…</p> : <Feedback state={feedback} showSuccess={showSuccess} />}</div>
    <div className="form-cta">
      <Button type="submit" disabled={pending} className="w-full md:w-auto" aria-label={pending ? "Salvando horários de funcionamento" : undefined}>{pending ? <><Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />…</> : "Salvar horários de funcionamento"}</Button>
    </div>
  </form>;
}
