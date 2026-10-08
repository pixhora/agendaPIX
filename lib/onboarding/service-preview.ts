import type { DepositMode } from "@/components/onboarding/types";
import { formatCents } from "@/lib/money";

export const SERVICE_DURATION_PRESETS = [
  { minutes: 30, label: "30 min" },
  { minutes: 45, label: "45 min" },
  { minutes: 60, label: "1 h" },
  { minutes: 90, label: "1 h 30" },
] as const;

export function serviceDurationLabel(minutes: number): string {
  return SERVICE_DURATION_PRESETS.find((item) => item.minutes === minutes)?.label ?? `${minutes} min`;
}

export type ServicePreviewHold = {
  durationMinutes: number | null;
  priceCents: number | null;
  depositCents: number | null;
};

export const EMPTY_SERVICE_PREVIEW_HOLD: ServicePreviewHold = {
  durationMinutes: null,
  priceCents: null,
  depositCents: null,
};

export type ServicePreviewInput = {
  durationMinutes: number;
  customDuration: boolean;
  priceCents: number;
  depositCents: number;
  depositMode: DepositMode;
};

export type ServicePreviewView = {
  durationMinutes: number | null;
  priceCents: number | null;
  depositCents: number | null;
  remainderCents: number | null;
  noDeposit: boolean;
  priceLabel: string;
  depositLabel: string;
  remainderLabel: string;
};

export function isPreviewDurationValid(minutes: number, custom: boolean): boolean {
  if (!Number.isInteger(minutes)) return false;
  if (!custom) return SERVICE_DURATION_PRESETS.some((item) => item.minutes === minutes);
  return minutes >= 5 && minutes <= 720 && minutes % 5 === 0;
}

function isPreviewPriceValid(cents: number): boolean {
  return Number.isInteger(cents) && cents >= 100;
}

function moneyLabel(cents: number | null): string {
  if (cents == null || cents <= 0) return "R$ —";
  return `R$ ${formatCents(cents)}`;
}

/**
 * The customer preview keeps the last valid duration, price and deposit.
 * An out-of-range duration or a deposit above the price does not replace them.
 */
export function projectServicePreview(hold: ServicePreviewHold, input: ServicePreviewInput): {
  hold: ServicePreviewHold;
  view: ServicePreviewView;
} {
  const durationMinutes = isPreviewDurationValid(input.durationMinutes, input.customDuration)
    ? input.durationMinutes
    : hold.durationMinutes;

  const livePriceOk = isPreviewPriceValid(input.priceCents);
  const noDeposit = input.depositMode === "none";
  let priceCents = livePriceOk ? input.priceCents : hold.priceCents;
  let depositCents = hold.depositCents;

  if (noDeposit) {
    depositCents = 0;
  } else if (livePriceOk && input.depositCents >= 0 && input.depositCents <= input.priceCents) {
    depositCents = input.depositCents;
  } else if (priceCents != null && hold.depositCents != null && hold.depositCents <= priceCents) {
    depositCents = hold.depositCents;
  } else {
    priceCents = hold.priceCents;
    depositCents = hold.depositCents;
  }

  const nextHold: ServicePreviewHold = { durationMinutes, priceCents, depositCents };
  const remainderCents = priceCents != null && depositCents != null ? priceCents - depositCents : null;

  return {
    hold: nextHold,
    view: {
      durationMinutes,
      priceCents,
      depositCents,
      remainderCents,
      noDeposit: noDeposit || depositCents === 0,
      priceLabel: moneyLabel(priceCents),
      depositLabel: moneyLabel(depositCents),
      remainderLabel: moneyLabel(remainderCents),
    },
  };
}
