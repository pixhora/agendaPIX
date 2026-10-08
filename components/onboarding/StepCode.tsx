"use client";

import { Mail, ShieldCheck } from "lucide-react";
import { OtpInput, type OtpVisualStatus } from "@/components/ui/otp-input";
import { OTP_LENGTH, formatResendWait } from "@/lib/onboarding/otp";
import { StepActions } from "./chrome";
import { StepHeader, stepBodyClass } from "./parts";

export function StepCode({
  email,
  code,
  onChangeCode,
  onComplete,
  status,
  message,
  resendSeconds,
  pending,
  locked,
  onResend,
  onChangeEmail,
  onBack,
}: {
  email: string;
  code: string;
  onChangeCode: (value: string) => void;
  onComplete: (value: string) => void;
  status: OtpVisualStatus;
  message: string | null;
  resendSeconds: number;
  pending: boolean;
  locked: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
  onBack: () => void;
}) {
  const waiting = resendSeconds > 0 && !locked;
  const showFreshCode = locked || message?.includes("Mandamos um novo");

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || locked || code.length < OTP_LENGTH) return;
        onComplete(code);
      }}
    >
      <div className={stepBodyClass}>
        <StepHeader
          title="Digite o código que mandamos"
          description={
            <>
              Enviamos 6 números para <strong className="font-semibold text-ink">{email}</strong>.{" "}
              <button type="button" onClick={onChangeEmail} className="inline-flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline">
                Trocar e-mail
              </button>
            </>
          }
        />
        <OtpInput
          value={code}
          onChange={onChangeCode}
          onComplete={onComplete}
          status={status}
          readOnly={pending || status === "success"}
          describedBy={message ? "otp-message" : "otp-hint"}
        />
        <p id="otp-hint" className="text-sm text-muted">O código vale por 30 minutos. Pode colar direto do e-mail.</p>
        {message ? <p id="otp-message" role="alert" aria-live="assertive" className="text-sm font-medium text-danger">{message}</p> : null}
        <div className="space-y-1">
          <p className="text-sm text-muted">Não chegou? Olhe o spam.</p>
          {showFreshCode ? (
            <button type="button" onClick={onResend} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline-offset-4 hover:underline">
              Enviar novo código
            </button>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={waiting || pending}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline-offset-4 hover:underline disabled:text-muted"
            >
              {waiting ? `Reenviar em ${formatResendWait(resendSeconds)}` : "Reenviar código"}
            </button>
          )}
        </div>
        <div className="flex gap-3 rounded-card border border-line bg-subtle px-3 py-3 text-sm text-muted">
          <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink" />
          <p>No mesmo e-mail tem o botão <strong className="font-semibold text-ink">Entrar no AgendaPix</strong>. Funciona em qualquer aparelho, não precisa ser este.</p>
        </div>
        <div className="flex gap-3 rounded-card border border-line px-3 py-3 text-sm">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pix" />
          <p><strong>Seu cadastro está guardado.</strong> Se fechar esta tela, é só abrir o e-mail que você continua de onde parou.</p>
        </div>
      </div>
      {locked ? null : (
        <StepActions
          onBack={onBack}
          submitLabel={pending ? "Confirmando…" : "Confirmar código"}
          pending={pending || status === "success"}
          disabled={code.length < OTP_LENGTH}
          onInvalid={() => document.getElementById("otp-code")?.focus()}
        />
      )}
    </form>
  );
}
