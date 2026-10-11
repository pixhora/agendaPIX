import { clearOnboardingProgress } from "@/components/onboarding/storage";
import { MP_CALLBACK_STORAGE_KEY } from "@/lib/mercadopago/contract";
import { redactOAuthReturnLog } from "@/lib/onboarding/oauth-return";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

/** Uma linha para o console. Sem e-mail, telefone ou stack. */
export function onboardingBoundaryLog(error: { message?: string; digest?: string }): string {
  const message = redactOAuthReturnLog((error.message ?? "").replace(EMAIL, "[email]").replace(PHONE, "[telefone]")).slice(0, 180);
  const digest = error.digest && /^[a-zA-Z0-9_-]{1,64}$/.test(error.digest) ? error.digest : "sem-digest";
  return `onboarding_mp_return digest=${digest} message=${message}`;
}

function defaultNavigate(href: string) {
  window.location.assign(href);
}

/** Apaga o rascunho local e abre de novo a tela de conectar o Mercado Pago. */
export function restartOnboardingConnection(navigate: (href: string) => void = defaultNavigate) {
  clearOnboardingProgress();
  try {
    sessionStorage.removeItem(MP_CALLBACK_STORAGE_KEY);
  } catch {
    // sessionStorage indisponível.
  }
  navigate("/onboarding/recebimento");
}
