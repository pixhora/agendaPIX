"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { STORE_DURATION_MINUTES } from "@/lib/onboarding/validation";
import { normalizeSlug } from "@/lib/slug";
import { STORE_WEEKDAYS, emptyStoreDays } from "@/lib/store-profile/model";
import { SLUG_COPY } from "@/lib/store-profile/slug-ui";
import { peekPendingLogo } from "@/lib/store-profile/pending-logo";
import { storeSubmission, type StoreFieldErrors } from "@/lib/store-profile/submit";
import type { OnboardingData, StoreDay } from "@/components/onboarding/types";
import { LogoUpload } from "./LogoUpload";
import { SlugField } from "./SlugField";
import { useStoreSlug } from "./use-store-slug";

const FOCUS: Record<string, string> = {
  name: "store-name",
  logo: "store-logo-button",
  slug: "store-slug",
  serviceName: "store-service-name",
  duration: "store-duration",
  price: "store-price",
  deposit: "store-deposit",
  days: "store-day-1",
};

export function StoreProfileForm({
  data,
  onChange,
  onContinue,
  onLogoPreview,
  prefix,
  pending,
  conflict,
  formError,
}: {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
  onContinue: () => void;
  onLogoPreview?: (url: string | null) => void;
  prefix: string;
  pending?: boolean;
  conflict?: { slug: string; suggestions: string[] } | null;
  formError?: string | null;
}) {
  const [attempted, setAttempted] = useState(false);
  const [logoPicked, setLogoPicked] = useState(false);
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});
  const days = data.days ?? emptyStoreDays();
  const finalSlug = normalizeSlug(data.slug, { final: true });
  const forced = Boolean(conflict && conflict.slug === finalSlug);
  const slug = useStoreSlug(data.slug, { paused: pending });
  const status = forced ? "taken" as const : slug.status;
  const message = forced ? SLUG_COPY.taken : slug.message;
  const suggestions = forced ? conflict?.suggestions.slice(0, 2) ?? [] : slug.suggestions;
  const checked = storeSubmission({ ...data, slug: finalSlug, days }, { logoSelected: logoPicked || Boolean(data.logoUrl) });
  const errors: StoreFieldErrors = checked.ok ? {} : checked.errors;
  const show = (key: keyof StoreFieldErrors) => Boolean((attempted || blurred[key]) && errors[key]);

  useEffect(() => {
    if (conflict) document.getElementById("store-slug")?.focus();
  }, [conflict]);
  useEffect(() => {
    if (formError) document.getElementById("store-form-error")?.focus();
  }, [formError]);
  const depositOn = (data.depositMode ?? "none") !== "none";
  const filledDay = days.find((day) => day.open && day.opensAt && day.closesAt && day.opensAt < day.closesAt);
  const showCopy = Boolean(filledDay) && days.filter((day) => day.open).length > 1;

  function patchDay(weekday: number, partial: Partial<StoreDay>) {
    onChange({
      days: days.map((day) => (day.weekday === weekday ? { ...day, ...partial } : day)),
    });
  }

  function focusFirst(next: StoreFieldErrors) {
    const order = ["name", "slug", "logo", "serviceName", "duration", "price", "deposit", "days"] as const;
    const key = order.find((item) => next[item]);
    const id = key ? FOCUS[key] : "store-slug";
    document.getElementById(id)?.focus();
  }

  return (
    <form
      className="flex flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const result = storeSubmission({ ...data, slug: finalSlug, days }, { logoSelected: logoPicked || Boolean(peekPendingLogo()) });
        if (!result.ok || status !== "available") {
          const next = result.ok ? {} : result.errors;
          setAttempted(true);
          focusFirst(next);
          return;
        }
        if (finalSlug !== data.slug) onChange({ slug: finalSlug });
        onContinue();
      }}
    >
      <div className="flex-1 space-y-5 px-5 pt-6 pb-4">
        <div className="space-y-2">
          <h1 className="font-display text-[28px] font-bold leading-[1.12] tracking-tight">Sua loja</h1>
          <p className="max-w-[40rem] text-[15px] leading-normal text-muted-foreground">É assim que seus clientes vão ver você.</p>
        </div>
        {formError ? (
          <div id="store-form-error" role="alert" tabIndex={-1} className="rounded-card border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="store-name">Nome da loja</Label>
          <Input
            id="store-name"
            value={data.businessName}
            maxLength={60}
            autoComplete="organization"
            placeholder="Ex.: Studio da Ana"
            aria-invalid={show("name") ? true : undefined}
            aria-describedby={show("name") ? "store-name-error" : "store-name-count"}
            onBlur={() => setBlurred((current) => ({ ...current, name: true }))}
            onChange={(event) => {
              const businessName = event.target.value;
              onChange(data.slugTouched ? { businessName } : { businessName, slug: normalizeSlug(businessName, { final: true }) });
            }}
          />
          <p id="store-name-count" className="text-sm text-muted-foreground">{data.businessName.length}/60</p>
          <FieldError id="store-name-error">{show("name") ? errors.name : null}</FieldError>
        </div>

        <SlugField
          id="store-slug"
          prefix={prefix}
          value={data.slug}
          disabled={pending}
          status={status}
          message={message}
          suggestions={suggestions}
          error={show("slug") ? errors.slug : null}
          onRetry={slug.retry}
          onBlur={() => setBlurred((current) => ({ ...current, slug: true }))}
          onValueChange={(slug) => onChange({ slug, slugTouched: true })}
          onPickSuggestion={(suggestion) => onChange({ slug: suggestion, slugTouched: true })}
        />

        <LogoUpload
          url={data.logoUrl || null}
          disabled={pending}
          onLocalPreview={(url) => { setLogoPicked(Boolean(url)); onLogoPreview?.(url); }}
          onChangeUrl={(logoUrl) => { if (logoUrl) onChange({ logoUrl }); }}
        />
        {show("logo") ? <FieldError id="store-logo-error">{errors.logo}</FieldError> : null}

        <div className="grid gap-1.5">
          <Label htmlFor="store-service-name">Nome do serviço</Label>
          <Input
            id="store-service-name"
            value={data.serviceName}
            placeholder="Ex.: Corte masculino"
            aria-invalid={show("serviceName") ? true : undefined}
            aria-describedby={show("serviceName") ? "store-service-error" : undefined}
            onBlur={() => setBlurred((current) => ({ ...current, serviceName: true }))}
            onChange={(event) => onChange({ serviceName: event.target.value })}
          />
          <FieldError id="store-service-error">{show("serviceName") ? errors.serviceName : null}</FieldError>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="store-duration">Duração</Label>
          <Select
            value={data.durationMinutes > 0 ? String(data.durationMinutes) : ""}
            onValueChange={(next) => onChange({ durationMinutes: Number(next) || 0 })}
            onOpenChange={(open) => {
              if (!open) setBlurred((current) => ({ ...current, duration: true }));
            }}
          >
            <SelectTrigger
              id="store-duration"
              aria-invalid={show("duration") ? true : undefined}
              aria-describedby={show("duration") ? "store-duration-error" : undefined}
              onBlur={() => setBlurred((current) => ({ ...current, duration: true }))}
            >
              <SelectValue placeholder="Escolha a duração" />
            </SelectTrigger>
            <SelectContent>
              {STORE_DURATION_MINUTES.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>{minutes} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="store-duration-error">{show("duration") ? errors.duration : null}</FieldError>
        </div>

        <MoneyInput
          id="store-price"
          label="Preço"
          valueCents={data.priceCents > 0 ? data.priceCents : null}
          error={show("price") ? errors.price : null}
          onChangeCents={(cents) => onChange({ priceCents: cents ?? 0 })}
        />

        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold">
          Cobrar sinal no Pix
          <Switch
            checked={depositOn}
            onChange={(event) => onChange({
              depositMode: event.target.checked ? "custom" : "none",
              depositCents: event.target.checked ? data.depositCents : 0,
            })}
          />
        </label>
        {depositOn ? (
          <MoneyInput
            id="store-deposit"
            label="Valor do sinal"
            valueCents={data.depositCents > 0 ? data.depositCents : null}
            error={show("deposit") ? errors.deposit : null}
            onChangeCents={(cents) => onChange({ depositCents: cents ?? 0, depositMode: "custom" })}
          />
        ) : null}

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">Horários</legend>
          {STORE_WEEKDAYS.map((meta) => {
            const day = days.find((item) => item.weekday === meta.weekday) ?? { weekday: meta.weekday, open: false, opensAt: "", closesAt: "" };
            const timeError = errors.dayTimes?.[meta.weekday];
            return (
              <div key={meta.weekday} className="grid gap-2 border-b border-border pb-3">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">
                    <span className="sr-only">{meta.name}. </span>
                    Aberto
                    <Switch
                      id={`store-day-${meta.weekday}`}
                      checked={day.open}
                      onChange={(event) => patchDay(meta.weekday, event.target.checked ? { open: true } : { open: false, opensAt: "", closesAt: "" })}
                    />
                  </label>
                </div>
                {day.open ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor={`store-open-${meta.weekday}`}>Início</Label>
                      <Input id={`store-open-${meta.weekday}`} type="time" value={day.opensAt} placeholder="--:--" onChange={(event) => patchDay(meta.weekday, { opensAt: event.target.value })} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor={`store-close-${meta.weekday}`}>Fim</Label>
                      <Input id={`store-close-${meta.weekday}`} type="time" value={day.closesAt} placeholder="--:--" aria-invalid={timeError ? true : undefined} onChange={(event) => patchDay(meta.weekday, { closesAt: event.target.value })} />
                    </div>
                  </div>
                ) : null}
                {timeError ? <FieldError>{timeError}</FieldError> : null}
              </div>
            );
          })}
          {showCopy && filledDay ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4"
              onClick={() => onChange({
                days: days.map((day) => day.open && day.weekday !== filledDay.weekday
                  ? { ...day, opensAt: filledDay.opensAt, closesAt: filledDay.closesAt }
                  : day),
              })}
            >
              Copiar para os outros dias abertos
            </button>
          ) : null}
          <FieldError id="store-days-error">{show("days") ? errors.days : null}</FieldError>
        </fieldset>
      </div>
      <div className="z-10 border-t border-border bg-paper/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:sticky max-md:bottom-0">
        <Button type="submit" size="lg" className="w-full" disabled={status !== "available" || pending} aria-busy={pending || undefined}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
          {pending ? "Salvando…" : "Continuar"}
        </Button>
      </div>
    </form>
  );
}
