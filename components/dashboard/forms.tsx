"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveHours, saveService } from "@/app/dashboard/(owner)/actions";
import type { FormState } from "@/lib/dashboard/validation";

export const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const control = "min-h-11 w-full rounded-md border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
function Feedback({ state }: { state: FormState }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.error) ref.current?.focus(); }, [state]);
  return <>{state.error && <p ref={ref} tabIndex={-1} role="alert" className="rounded-md border border-border p-3 font-medium">{state.error}</p>}{state.success && <p role="status" className="rounded-md bg-muted p-3 font-medium">{state.success}</p>}</>;
}
type Service = { id: string; name: string; durationMinutes: number; priceCents: number; depositCents: number; active: boolean };
export function ServiceForm({ businessId, service }: { businessId: string; service?: Service }) {
  const [state, action, pending] = useActionState(saveService, {});
  const prefix = service?.id ?? "new";
  const [values, setValues] = useState({ name: service?.name ?? "", duration: String(service?.durationMinutes ?? 30), price: service ? (service.priceCents / 100).toFixed(2) : "", deposit: service ? (service.depositCents / 100).toFixed(2) : "0,00", active: service?.active ?? true });
  return <form action={action} className="grid gap-4" aria-label={service ? `Editar ${service.name}` : "Cadastrar serviço"}>
    <input type="hidden" name="businessId" value={businessId} />
    {service && <input type="hidden" name="id" value={service.id} />}
    <label htmlFor={`${prefix}-name`} className="grid gap-2">Nome do serviço<input className={control} id={`${prefix}-name`} name="name" required maxLength={120} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
    <div className="grid gap-4 sm:grid-cols-3">
      <label htmlFor={`${prefix}-duration`} className="grid gap-2">Duração (minutos)<input className={control} id={`${prefix}-duration`} name="durationMinutes" type="number" min={1} max={1440} required value={values.duration} onChange={(event) => setValues({ ...values, duration: event.target.value })} /></label>
      <label htmlFor={`${prefix}-price`} className="grid gap-2">Preço (R$)<input className={control} id={`${prefix}-price`} name="price" inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" required value={values.price} onChange={(event) => setValues({ ...values, price: event.target.value })} /></label>
      <label htmlFor={`${prefix}-deposit`} className="grid gap-2">Sinal (R$)<input className={control} id={`${prefix}-deposit`} name="deposit" inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" required value={values.deposit} onChange={(event) => setValues({ ...values, deposit: event.target.value })} /></label>
    </div>
    <p className="text-sm text-muted-foreground">O sinal deve ser menor ou igual ao preço. Sinal zero confirma o horário sem cobrança.</p>
    <label className="flex min-h-11 items-center gap-3"><input className="size-5 accent-primary" type="checkbox" name="active" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} />Disponível para agendamento</label>
    <Feedback state={state} />
    <Button type="submit" disabled={pending} className="justify-self-start">{pending ? "Salvando serviço…" : service ? "Salvar serviço" : "Cadastrar serviço"}</Button>
  </form>;
}
export function HoursForm({ businessId, hours }: { businessId: string; hours: { weekday: number; opensAt: string; closesAt: string }[] }) {
  const [state, action, pending] = useActionState(saveHours, {});
  const [days, setDays] = useState(weekdays.map((_, weekday) => { const value = hours.find((hour) => hour.weekday === weekday); return { open: !!value, start: value?.opensAt.slice(0, 5) ?? "09:00", end: value?.closesAt.slice(0, 5) ?? "18:00" }; }));
  function changeDay(weekday: number, value: Partial<(typeof days)[number]>) { setDays(days.map((day, index) => index === weekday ? { ...day, ...value } : day)); }
  return <form action={action} className="grid gap-4" aria-label="Horários de funcionamento">
    <input type="hidden" name="businessId" value={businessId} />
    {weekdays.map((day, weekday) => {
      const value = days[weekday];
      return <fieldset key={day} className="grid gap-3 border-b border-border pb-4 sm:grid-cols-[1fr_1fr_1fr]">
        <legend className="mb-2 font-semibold">{day}</legend>
        <label className="flex min-h-11 items-center gap-3"><input className="size-5 accent-primary" type="checkbox" name={`open-${weekday}`} checked={value.open} onChange={(event) => changeDay(weekday, { open: event.target.checked })} />Aberto</label>
        <label className="grid gap-2" htmlFor={`start-${weekday}`}>Abre às<input className={control} id={`start-${weekday}`} name={`start-${weekday}`} type="time" value={value.start} onChange={(event) => changeDay(weekday, { start: event.target.value })} disabled={!value.open} required /></label>
        <label className="grid gap-2" htmlFor={`end-${weekday}`}>Fecha às<input className={control} id={`end-${weekday}`} name={`end-${weekday}`} type="time" value={value.end} onChange={(event) => changeDay(weekday, { end: event.target.value })} disabled={!value.open} required /></label>
      </fieldset>;
    })}
    <p className="text-sm text-muted-foreground">Desmarque “Aberto” nos dias sem atendimento. Os horários seguem o fuso do negócio.</p>
    <Feedback state={state} />
    <Button type="submit" disabled={pending} className="justify-self-start">{pending ? "Salvando horários…" : "Salvar horários de funcionamento"}</Button>
  </form>;
}
