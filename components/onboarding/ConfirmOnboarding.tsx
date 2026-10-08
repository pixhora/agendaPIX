"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { quietCtaClass } from "@/components/onboarding/chrome";
import { FieldError } from "@/components/ui/field";
import { OtpInput, type OtpVisualStatus } from "@/components/ui/otp-input";
import { BrandLink } from "@/components/ui/brand";
import { cn } from "@/lib/utils";
import { CONFIRM_CODE_MESSAGE, confirmIdleTarget, confirmMaskedEmailHint, confirmSubmitReady, confirmSupportCopy } from "@/lib/onboarding/confirm-ready";
import { INVALID_EMAIL_MESSAGE, isUsableEmail } from "@/lib/onboarding/email-hint";
import { commitOnboardingDraft, getOnboardingDraft } from "@/lib/onboarding/drafts-client";
import { followUpFromFailure } from "@/lib/onboarding/commit-follow-up";
import { signInWithEmailOtp } from "@/lib/onboarding/auth-otp";
import { OTP_LENGTH, mapOtpError, otpDigits, wrongCodeMessage } from "@/lib/onboarding/otp";
import { clearOnboardingProgress, readOnboardingDraftRaw, writeCommitResult } from "./storage";
import { restoreOnboardingDraft } from "@/lib/onboarding/flow";

const HAS_BUSINESS_TOAST = "Você já tem uma página. Abrimos o seu painel.";
const CONSUMED_TOAST = "Esse cadastro já virou uma página. Abrimos o seu painel.";

function readFragmentCode(): string {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  return otpDigits(new URLSearchParams(hash).get("c") ?? "");
}

function clearFragment() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", next);
}

export function ConfirmOnboarding({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [needEmail, setNeedEmail] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [fromFragment, setFromFragment] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<OtpVisualStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const local = restoreOnboardingDraft(readOnboardingDraftRaw(), "completo");

  useEffect(() => {
    const fragmentCode = readFragmentCode();
    clearFragment();
    const stored = restoreOnboardingDraft(readOnboardingDraftRaw(), "completo");
    const storedEmail = isUsableEmail(stored.email) ? stored.email : "";
    queueMicrotask(() => {
      if (fragmentCode.length === OTP_LENGTH) {
        setCode(fragmentCode);
        setFromFragment(true);
      }
      setEmail(storedEmail);
      setNeedEmail(!storedEmail);
      setReady(true);
    });
    if (!draftId) return;
    void getOnboardingDraft(draftId).then((result) => {
      if (!result.ok) {
        if (result.error.code === "draft_expired") {
          setMessage("Seu cadastro guardado venceu (7 dias). Vamos começar de novo? Leva poucos minutos.");
        }
        if (result.error.code === "draft_consumed") {
          toast(CONSUMED_TOAST);
          router.push("/dashboard");
        }
        return;
      }
      if (result.draft.businessName) setBusinessName(result.draft.businessName);
      if (!storedEmail && result.draft.email && !isUsableEmail(result.draft.email)) {
        setMaskedEmail(result.draft.email);
      }
      if (!storedEmail && isUsableEmail(result.draft.email) && result.draft.email) {
        setEmail(result.draft.email);
        setNeedEmail(false);
      }
    });
  }, [draftId, router]);

  function revealIdle(value = code) {
    const problem = confirmIdleTarget({ code: value, email, emailRequired: needEmail, pending });
    if (!problem) return;
    setNeedEmail(problem.id === "confirm-email" || needEmail);
    setMessage(problem.message);
    window.setTimeout(() => document.getElementById(problem.id)?.focus(), 0);
  }

  async function enter(value = code) {
    if (pending) return;
    if (!confirmSubmitReady({ code: value, email, emailRequired: needEmail })) {
      revealIdle(value);
      return;
    }
    if (!navigator.onLine) {
      setMessage("Sem internet. Quando voltar, toque em Confirmar código.");
      return;
    }
    setPending(true);
    setStatus("loading");
    setMessage(null);
    const signed = await signInWithEmailOtp(email, value, businessName ?? local.businessName);
    if (!signed.ok) {
      setPending(false);
      if (signed.code === "RATE_LIMITED" || signed.code === "rate_limited") {
        setStatus("error");
        setMessage("Muitas tentativas. Espere e tente de novo.");
        return;
      }
      const failure = mapOtpError(signed.code, attemptsUsed);
      if (failure.kind === "invalid") {
        setAttemptsUsed((current) => current + 1);
        setCode("");
        setStatus("error");
        setMessage(wrongCodeMessage(failure.remaining));
        return;
      }
      if (failure.kind === "locked" || failure.kind === "expired") {
        setCode("");
        setStatus("error");
        setMessage("Esse botão já foi usado ou venceu. Peça um código novo, leva segundos.");
        return;
      }
      setStatus("error");
      setMessage("Algo deu errado do nosso lado. Seus dados estão guardados; tente de novo.");
      return;
    }
    if (!draftId) {
      setPending(false);
      setStatus("idle");
      setMessage("Não encontramos um cadastro para continuar. Comece de novo, leva poucos minutos.");
      return;
    }
    const committed = await commitOnboardingDraft(draftId);
    setPending(false);
    if (committed.ok) {
      writeCommitResult({ slug: committed.slug, publicPath: committed.publicPath });
      clearOnboardingProgress();
      setStatus("success");
      router.push("/onboarding/concluir");
      return;
    }
    const follow = followUpFromFailure(committed.status, committed.error);
    if (follow.type === "has_business") {
      toast(HAS_BUSINESS_TOAST);
      router.push("/dashboard");
      return;
    }
    if (follow.type === "consumed") {
      toast(CONSUMED_TOAST);
      clearOnboardingProgress();
      router.push("/dashboard");
      return;
    }
    if (follow.type === "slug_taken") {
      router.push("/onboarding");
      return;
    }
    if (follow.type === "wrong_email") {
      setNeedEmail(true);
      setStatus("error");
      setMessage("Esse cadastro é de outro e-mail. Entre com o e-mail que você usou no começo.");
      return;
    }
    if (follow.type === "unauthorized") {
      setStatus("error");
      setMessage("Sua sessão expirou. Entre de novo com um código.");
      return;
    }
    if (follow.type === "expired") {
      const hasLocal = Boolean(readOnboardingDraftRaw());
      setMessage(hasLocal
        ? "Seu cadastro guardado venceu, mas os dados ainda estão neste aparelho."
        : "Seu cadastro guardado venceu (7 dias). Vamos começar de novo? Leva poucos minutos.");
      return;
    }
    if (follow.type === "offline") {
      setMessage("Sem internet. Sua conta está pronta; a página é criada assim que a conexão voltar.");
      return;
    }
    setMessage("Não conseguimos criar sua página agora. Seus dados estão guardados.");
  }

  const emailInvalid = needEmail && message === INVALID_EMAIL_MESSAGE;
  const emailHint = needEmail ? confirmMaskedEmailHint(maskedEmail) : null;
  const readyToConfirm = confirmSubmitReady({ code, email, emailRequired: needEmail });
  const quietCta = !pending && !readyToConfirm;
  const primary = cn(buttonVariants({ size: "lg" }), "w-full");
  const showRestart = message?.includes("Comece de novo") || message?.includes("começar de novo") || message?.includes("Peça um código novo");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center px-4 sm:px-6"><BrandLink /></div>
      </header>
      <main id="content" className="flex flex-1 items-start justify-center px-4 pt-6 pb-10 sm:pt-8">
        <div className="w-full max-w-md rounded-frame border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          {!ready ? (
            <div role="status" className="flex justify-center py-10">
              <Loader2 aria-hidden="true" className="size-8 animate-spin text-pix motion-reduce:animate-none" />
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (pending || !readyToConfirm) {
                  revealIdle();
                  return;
                }
                void enter();
              }}
            >
              <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">Continuar seu cadastro</h1>
              {businessName ? <p className="font-display text-xl font-bold leading-tight tracking-tight">{businessName}</p> : null}
              <p className="text-[15px] text-muted">{confirmSupportCopy(fromFragment)}</p>
              {needEmail ? (
                <div className="grid gap-1.5">
                  <label htmlFor="confirm-email" className="text-sm font-semibold">E-mail</label>
                  <input
                    id="confirm-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={email}
                    aria-invalid={emailInvalid ? true : undefined}
                    aria-describedby={[emailHint ? "confirm-email-hint" : "", emailInvalid ? "confirm-message" : ""].filter(Boolean).join(" ") || undefined}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (message === INVALID_EMAIL_MESSAGE) setMessage(null);
                    }}
                    className="onb-control min-h-12 w-full rounded-field border border-line-strong/60 bg-surface px-3.5 text-base aria-invalid:border-danger"
                  />
                  {emailHint ? <p id="confirm-email-hint" className="text-sm text-muted">{emailHint}</p> : null}
                  {emailInvalid ? <FieldError id="confirm-message">{INVALID_EMAIL_MESSAGE}</FieldError> : null}
                </div>
              ) : null}
              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend className="mb-1.5 px-0 text-sm font-semibold">Código de 6 dígitos</legend>
                <OtpInput
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    if (status === "error") setStatus("idle");
                    if (message === CONFIRM_CODE_MESSAGE) setMessage(null);
                  }}
                  onComplete={(next) => void enter(next)}
                  status={status}
                  readOnly={pending}
                  describedBy={message && !emailInvalid ? "confirm-message" : undefined}
                />
              </fieldset>
              {message && !emailInvalid ? <FieldError id="confirm-message">{message}</FieldError> : null}
              {showRestart ? (
                <Link href="/onboarding" className={primary}>Receber novo código</Link>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  className={cn("mt-6 w-full", quietCta && quietCtaClass)}
                  aria-busy={pending || undefined}
                  aria-disabled={quietCta || undefined}
                  onClick={(event) => {
                    if (pending) event.preventDefault();
                  }}
                >
                  {pending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}
                  Confirmar código
                </Button>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
