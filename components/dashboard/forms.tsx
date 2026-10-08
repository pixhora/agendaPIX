"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveHours, saveService, saveWhatsapp } from "@/app/dashboard/(owner)/actions";
import type { FormState } from "@/lib/dashboard/validation";
import { depositPolicyPresets, PADRAO_DEPOSIT_POLICY, type DepositPolicy } from "@/lib/policy/schema";
import { ownerPreview } from "@/lib/policy/text";
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

type Service = { id: string; name: string; durationMinutes: number; priceCents: number; depositCents: number; active: boolean; depositPolicy?: DepositPolicy };
const POLICY_OPTIONS = [
  ["flexivel", "Flexível"],
  ["padrao", "Padrão"],
  ["rigida", "Rígida"],
] as const;
const initialValues = (service?: Service) => ({ name: service?.name ?? "", duration: String(service?.durationMinutes ?? 30), price: service ? (service.priceCents / 100).toFixed(2) : "", deposit: service ? (service.depositCents / 100).toFixed(2) : "0,00", active: service?.active ?? true });

function centsFromInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  const [whole, decimal = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}

export function ServiceForm({ businessId, businessName, service }: { businessId: string; businessName: string; service?: Service }) {
  const [state, action, pending] = useActionState(saveService, {});
  const [showSuccess, setShowSuccess] = useState(true);
  const prefix = service?.id ?? "new";
  const [values, setValues] = useState(() => initialValues(service));
  const [policy, setPolicy] = useState<DepositPolicy>(service?.depositPolicy ?? PADRAO_DEPOSIT_POLICY);
  // Após cadastrar um serviço novo, limpa o formulário (ajuste de estado durante o render, sem efeito).
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.success && !service) {
      setValues(initialValues());
      setPolicy(PADRAO_DEPOSIT_POLICY);
    }
  }
  return <form action={action} onChange={() => setShowSuccess(false)} onSubmit={() => setShowSuccess(true)} className="grid gap-4" aria-busy={pending} aria-label={service ? `Editar ${service.name}` : "Cadastrar serviço"}>
    <input type="hidden" name="businessId" value={businessId} />
    <input type="hidden" name="depositPolicy" value={JSON.stringify(policy)} />
    {service && <input type="hidden" name="id" value={service.id} />}
    <label htmlFor={`${prefix}-name`} className={labelClass}>Nome do serviço<Input id={`${prefix}-name`} name="name" required maxLength={120} placeholder="Ex.: Corte masculino" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
    <div className="grid grid-cols-2 gap-3">
      <label htmlFor={`${prefix}-duration`} className={cn(labelClass, "col-span-2")}>Duração (minutos)<Input id={`${prefix}-duration`} name="durationMinutes" type="number" min={1} max={1440} required className="tabular-nums" value={values.duration} onChange={(event) => setValues({ ...values, duration: event.target.value })} /></label>
      <label htmlFor={`${prefix}-price`} className={labelClass}>Preço<MoneyInput id={`${prefix}-price`} name="price" required placeholder="0,00" value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} /></label>
      <label htmlFor={`${prefix}-deposit`} className={labelClass}>Sinal via Pix<MoneyInput id={`${prefix}-deposit`} name="deposit" required value={values.deposit} onChange={(event) => setValues({ ...values, deposit: event.target.value })} /></label>
    </div>
    <p className="text-sm text-muted">O sinal deve ser menor ou igual ao preço. Sinal zero confirma o horário sem cobrança.</p>
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">Política do sinal</legend>
      <div className="flex flex-wrap gap-2">
        {POLICY_OPTIONS.map(([preset, label]) => (
          <label key={preset} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm font-semibold has-[:checked]:border-ink has-[:checked]:bg-subtle">
            <input type="radio" name={`${prefix}-policy`} checked={policy.preset === preset} onChange={() => setPolicy(depositPolicyPresets[preset])} />
            {label}
          </label>
        ))}
        {policy.preset === "personalizada" && <p className="inline-flex min-h-11 items-center text-sm font-semibold">Personalizada</p>}
      </div>
      <p aria-live="polite" className="max-w-[65ch] text-sm text-muted">{ownerPreview(policy, { businessName, depositCents: centsFromInput(values.deposit) })}</p>
      <p className="text-sm text-muted">A devolução não é automática. Você confirma em Devolver pelo AgendaPix, e o valor sai da sua conta Mercado Pago. Mudanças valem para novas reservas.</p>
    </fieldset>
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><Switch name="active" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} />Disponível para agendamento</label>
    <div aria-live="polite" className="empty:hidden">{pending ? <p role="status" className="text-sm text-muted">Salvando alterações…</p> : <Feedback state={state} showSuccess={showSuccess} />}</div>
    <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">{pending ? "Salvando serviço…" : service ? "Salvar serviço" : "Cadastrar serviço"}</Button>
  </form>;
}

export function WhatsappForm({ businessId, contactWhatsapp }: { businessId: string; contactWhatsapp: string | null }) {
  const [state, action, pending] = useActionState(saveWhatsapp, {});
  const [showSuccess, setShowSuccess] = useState(true);
  return <form action={action} onChange={() => setShowSuccess(false)} onSubmit={() => setShowSuccess(true)} className="grid gap-4" aria-busy={pending}>
    <input type="hidden" name="businessId" value={businessId} />
    <label htmlFor="contact-whatsapp" className={labelClass}>WhatsApp do negócio
      <Input id="contact-whatsapp" name="contactWhatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+55 11 99999-9999" defaultValue={contactWhatsapp ?? ""} />
    </label>
    <p id="contact-whatsapp-hint" className="text-sm text-muted">Opcional. Seus clientes usam esse número para falar com você.</p>
    <div aria-live="polite" className="empty:hidden">{pending ? <p role="status" className="text-sm text-muted">Salvando WhatsApp…</p> : <Feedback state={state} showSuccess={showSuccess} />}</div>
    <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">{pending ? "Salvando WhatsApp…" : "Salvar WhatsApp"}</Button>
  </form>;
}

export function HoursForm({ businessId, hours }: { businessId: string; hours: { weekday: number; opensAt: string; closesAt: string }[] }) {
  const [state, action, pending] = useActionState(saveHours, {});
  const [showSuccess, setShowSuccess] = useState(true);
  const [days, setDays] = useState(weekdays.map((_, weekday) => { const value = hours.find((hour) => hour.weekday === weekday); return { open: !!value, start: value?.opensAt.slice(0, 5) ?? "09:00", end: value?.closesAt.slice(0, 5) ?? "18:00" }; }));
  function changeDay(weekday: number, value: Partial<(typeof days)[number]>) { setDays(days.map((day, index) => index === weekday ? { ...day, ...value } : day)); }
  // Exibe de segunda a domingo (como a agenda semanal), mantendo os índices 0–6 do contrato.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return <form action={action} onChange={() => setShowSuccess(false)} onSubmit={() => setShowSuccess(true)} className="grid gap-4" aria-busy={pending} aria-label="Horários de funcionamento">
    <input type="hidden" name="businessId" value={businessId} />
    <div className="divide-y divide-line rounded-field border border-line">
      {order.map((weekday) => {
        const day = weekdays[weekday];
        const value = days[weekday];
        return <fieldset key={day} className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(8rem,10rem)_minmax(8rem,10rem)] sm:gap-4 sm:px-4">
          <legend className="sr-only">{day}</legend>
          <label className="col-span-2 flex min-h-11 items-center gap-3 sm:col-span-1">
            <Switch name={`open-${weekday}`} checked={value.open} onChange={(event) => changeDay(weekday, { open: event.target.checked })} aria-label={`${day}: aberto`} />
            <span className="font-semibold">{day}</span>
            <span className={cn("ml-auto text-xs font-semibold sm:hidden", value.open ? "text-success" : "text-muted")}>{value.open ? "Aberto" : "Fechado"}</span>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted" htmlFor={`start-${weekday}`}>Abre às<Input className="tabular-nums" id={`start-${weekday}`} name={`start-${weekday}`} type="time" value={value.start} onChange={(event) => changeDay(weekday, { start: event.target.value })} disabled={!value.open} required /></label>
          <label className="grid gap-1 text-xs font-semibold text-muted" htmlFor={`end-${weekday}`}>Fecha às<Input className="tabular-nums" id={`end-${weekday}`} name={`end-${weekday}`} type="time" value={value.end} onChange={(event) => changeDay(weekday, { end: event.target.value })} disabled={!value.open} required /></label>
        </fieldset>;
      })}
    </div>
    <p className="text-sm text-muted">Desligue os dias sem atendimento. Cada dia aceita um intervalo.</p>
    {!days.some((day) => day.open) && <p role="status" className="rounded-field border border-warning/30 bg-warning-soft p-3 text-sm text-warning">Nenhum dia selecionado. Ao salvar, sua agenda ficará fechada para novos agendamentos.</p>}
    <div aria-live="polite" className="empty:hidden">{pending ? <p role="status" className="text-sm text-muted">Salvando alterações…</p> : <Feedback state={state} showSuccess={showSuccess} />}</div>
    <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">{pending ? "Salvando horários…" : "Salvar horários de funcionamento"}</Button>
  </form>;
}
