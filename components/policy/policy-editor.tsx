"use client";

import { AlertTriangle, Info } from "lucide-react";
import {
  LATE_CANCEL_OUTCOMES,
  NO_SHOW_OUTCOMES,
  POLICY_HOUR_VALUES,
  depositPolicyPresets,
  type DepositPolicy,
} from "@/lib/policy/schema";
import { policyPreviewCopy } from "@/lib/dashboard/policy-preview";
import { PRESET_CHOICES, isHarshPolicy, type PolicyFormState, type PresetChoice } from "@/lib/dashboard/policy-form";
import { cn } from "@/lib/utils";

const PRESET_LABEL: Record<PresetChoice, string> = {
  flexivel: "Flexível",
  padrao: "Padrão",
  rigida: "Rígida",
};

const LATE_LABEL: Record<(typeof LATE_CANCEL_OUTCOMES)[number], { title: string; hint?: string }> = {
  retain: { title: "O sinal fica com você" },
  credit: { title: "Vira crédito para outro horário", hint: "Válido por 60 dias. Por enquanto, você anota o crédito do cliente." },
};

const NO_SHOW_LABEL: Record<(typeof NO_SHOW_OUTCOMES)[number], { title: string; hint?: string }> = {
  retain: { title: "O sinal fica com você" },
  credit: { title: "Vira crédito para outro horário", hint: "Válido por 60 dias. Por enquanto, você anota o crédito do cliente." },
  refund: {
    title: "Você devolve o sinal",
    hint: "Não é automático. Você confirma em Devolver pelo AgendaPix, e o valor sai da sua conta Mercado Pago.",
  },
};

function Chip({ name, checked, value, label, onSelect }: { name: string; checked: boolean; value: string; label: string; onSelect: () => void }) {
  return (
    <label className={cn(
      "control-shell inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 px-3 text-sm font-semibold",
      checked ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
    )}>
      <input className="sr-only" type="radio" name={name} value={value} checked={checked} onChange={onSelect} />
      {label}
    </label>
  );
}

export function PolicyEditor({
  idPrefix,
  businessName,
  depositCents,
  contactWhatsapp = null,
  policy,
  onPreset,
  onCustom,
}: {
  idPrefix: string;
  businessName: string;
  depositCents: number;
  contactWhatsapp?: string | null;
  policy: PolicyFormState["policy"];
  onPreset: (preset: PresetChoice) => void;
  onCustom: (patch: Partial<Pick<DepositPolicy, "refundUntilHours" | "rescheduleUntilHours" | "lateCancel" | "noShow">>) => void;
}) {
  const { summary, details, owner } = policyPreviewCopy(policy, businessName, depositCents, contactWhatsapp);
  const harsh = isHarshPolicy(policy);

  return (
    <fieldset className="grid min-w-0 gap-5 border-0 p-0">
      <legend className="text-sm font-semibold">Política do sinal</legend>
      <div role="radiogroup" aria-label="Modelo da política" className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        {PRESET_CHOICES.map((preset) => {
          const selected = policy.preset === preset;
          return (
            <label key={preset} className={cn(
              "control-shell flex min-h-[4.75rem] cursor-pointer flex-col justify-center rounded-card border-2 px-3 py-2",
              selected ? "border-ink bg-surface" : "border-line bg-surface",
            )}>
              <input className="sr-only" type="radio" name={`${idPrefix}-preset`} value={preset} checked={selected} onChange={() => onPreset(preset)} />
              {preset === "padrao" && <span className="text-[11px] font-bold text-pix">Recomendada</span>}
              <span className="font-display text-[15px] font-bold">{PRESET_LABEL[preset]}</span>
              <span className="line-clamp-2 text-xs leading-snug text-muted">{policyPreviewCopy(depositPolicyPresets[preset], businessName, depositCents, contactWhatsapp).summary}</span>
            </label>
          );
        })}
        <label className={cn(
          "control-shell flex min-h-[4.75rem] cursor-pointer flex-col justify-center rounded-card border-2 px-3 py-2",
          policy.preset === "personalizada" ? "border-ink bg-surface" : "border-line bg-surface",
        )}>
          <input className="sr-only" type="radio" name={`${idPrefix}-preset`} value="personalizada" checked={policy.preset === "personalizada"} onChange={() => onCustom({})} />
          <span className="font-display text-[15px] font-bold">Personalizada</span>
          <span className="text-xs text-muted">Suas regras abaixo</span>
        </label>
      </div>

      <div className="grid gap-2">
        <span id={`${idPrefix}-refund-label`} className="text-sm font-semibold">Devolver o sinal até</span>
        <div role="radiogroup" aria-labelledby={`${idPrefix}-refund-label`} className="flex flex-wrap gap-2">
          {POLICY_HOUR_VALUES.map((hours) => (
            <Chip key={hours} name={`${idPrefix}-refund`} value={String(hours)} label={`${hours} h antes`} checked={policy.refundUntilHours === hours} onSelect={() => onCustom({ refundUntilHours: hours })} />
          ))}
          <Chip name={`${idPrefix}-refund`} value="none" label="Sem devolução" checked={policy.refundUntilHours === null} onSelect={() => onCustom({ refundUntilHours: null })} />
        </div>
      </div>

      <div className="grid gap-2">
        <span id={`${idPrefix}-reschedule-label`} className="text-sm font-semibold">Remarcar usando o sinal até</span>
        <div role="radiogroup" aria-labelledby={`${idPrefix}-reschedule-label`} className="flex flex-wrap gap-2">
          {POLICY_HOUR_VALUES.map((hours) => (
            <Chip key={hours} name={`${idPrefix}-reschedule`} value={String(hours)} label={`${hours} h antes`} checked={policy.rescheduleUntilHours === hours} onSelect={() => onCustom({ rescheduleUntilHours: hours })} />
          ))}
          <Chip name={`${idPrefix}-reschedule`} value="none" label="Não permite" checked={policy.rescheduleUntilHours === null} onSelect={() => onCustom({ rescheduleUntilHours: null })} />
        </div>
      </div>

      <OutcomeGroup
        legend="Se cancelar depois desse prazo"
        name={`${idPrefix}-late`}
        value={policy.lateCancel}
        options={LATE_CANCEL_OUTCOMES.map((value) => ({ value, ...LATE_LABEL[value] }))}
        onSelect={(lateCancel) => onCustom({ lateCancel })}
      />
      <OutcomeGroup
        legend="Se o cliente faltar"
        name={`${idPrefix}-noshow`}
        value={policy.noShow}
        options={NO_SHOW_OUTCOMES.map((value) => ({ value, ...NO_SHOW_LABEL[value] }))}
        onSelect={(noShow) => onCustom({ noShow })}
      />

      <div aria-live="polite" className="rounded-card bg-pix-soft p-4">
        <p className="text-xs font-bold text-pix">Seu cliente vai ler assim</p>
        <p className="mt-2 max-w-[65ch] text-sm font-semibold leading-snug text-ink">{summary}</p>
        {details.length > 0 && <ul className="mt-3 grid gap-3">
          {details.map((line) => <li key={line.title}>
            <p className="text-sm font-semibold text-ink">{line.title}</p>
            <p className="max-w-[65ch] text-sm leading-relaxed text-ink">{line.body}</p>
          </li>)}
        </ul>}
      </div>
      {depositCents > 0 && <p className="max-w-[65ch] text-sm leading-relaxed text-muted"><span className="font-semibold text-ink">Para você. </span>{owner}</p>}

      {harsh && (
        <p className="flex items-start gap-2 text-sm text-warning">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Regra bem rígida. Clientes costumam desistir quando não podem nem remarcar.
        </p>
      )}

      <ul className="grid gap-2 text-[13px] leading-snug text-muted">
        <li className="flex items-start gap-2"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />A devolução não é automática. Você confirma em Devolver pelo AgendaPix, e o valor sai da sua conta Mercado Pago.</li>
        <li className="flex items-start gap-2"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />Mudanças valem para novas reservas. Quem já reservou continua com a regra que leu.</li>
      </ul>
    </fieldset>
  );
}

function OutcomeGroup<T extends string>({ legend, name, value, options, onSelect }: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; title: string; hint?: string }[];
  onSelect: (value: T) => void;
}) {
  return (
    <fieldset className="grid gap-2 border-0 p-0">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line">
        {options.map((option) => (
          <label key={option.value} className="control-shell flex min-h-[3.25rem] cursor-pointer items-start gap-3 border border-transparent px-3 py-3">
            <input className="mt-1 size-5 shrink-0 accent-ink" type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onSelect(option.value)} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{option.title}</span>
              {option.hint && <span className="mt-0.5 block text-xs leading-snug text-muted">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
