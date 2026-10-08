"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { isValidEmail } from "@/lib/onboarding/email-hint";
import {
  draftBodyFromOnboarding,
  previousStep,
  restoreOnboardingDraft,
  saveDraftThenSendOtp,
  stepperIndex,
  stepFromStored,
  TAKEN_LATER,
  createOnboardingData,
} from "@/lib/onboarding/flow";
import { followUpFromFailure } from "@/lib/onboarding/commit-follow-up";
import { commitOnboardingDraft, createOnboardingDraft, patchOnboardingDraft } from "@/lib/onboarding/drafts-client";
import { sendSignInOtp, signInWithEmailOtp } from "@/lib/onboarding/auth-otp";
import { mapOtpError, RESEND_WAIT_SECONDS, wrongCodeMessage } from "@/lib/onboarding/otp";
import { normalizeSlug } from "@/lib/slug";
import type { OnboardingData, OnboardingStep } from "./types";
import { StepBusiness } from "./StepBusiness";
import { StepService } from "./StepService";
import { StepHours } from "./StepHours";
import { StepEmail, type EmailAlert } from "./StepEmail";
import { StepCode } from "./StepCode";
import { StepCreating, type CreatingAlert } from "./StepCreating";
import { OnboardingPreview } from "./OnboardingPreview";
import { OnboardingStepper, OnboardingTopBar } from "./chrome";
import {
  clearOnboardingProgress,
  readDraftId,
  readOnboardingDraftRaw,
  readOnboardingStep,
  writeCommitResult,
  writeDraftId,
  writeOnboardingDraft,
  writeOnboardingStep,
} from "./storage";
import type { OtpVisualStatus } from "@/components/ui/otp-input";

const STEPPER = [
  { id: "business", label: "Nome e link" },
  { id: "service", label: "Serviço" },
  { id: "hours", label: "Horários" },
  { id: "access", label: "Acesso" },
];

const HAS_BUSINESS_TOAST = "Você já tem uma página. Abrimos o seu painel.";
const SESSION_EXPIRED = "Sua sessão expirou. Entre de novo com um código.";
const LOCKED = "Esse código foi bloqueado por segurança. Mandamos um novo?";
const EXPIRED = "Esse código venceu. Mandamos um novo?";
const GENERIC = "Algo deu errado do nosso lado. Seus dados estão guardados; tente de novo.";

type LinkConflict = { slug: string; message: string; suggestions: string[]; source: "create" | "commit" };

function onlineNow() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function OnboardingFlow({ legalPagesPublished = false }: { legalPagesPublished?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plano") === "base" ? "base" : "completo";
  const [step, setStep] = useState<OnboardingStep>("business");
  const [data, setData] = useState<OnboardingData>(() => createOnboardingData(initialPlan));
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkConflict, setLinkConflict] = useState<LinkConflict | null>(null);
  const [businessNotice, setBusinessNotice] = useState<string | null>(null);
  const [businessPending, setBusinessPending] = useState(false);
  const [emailAlert, setEmailAlert] = useState<EmailAlert>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<OtpVisualStatus>("idle");
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [otpEmail, setOtpEmail] = useState("");
  const [codeLocked, setCodeLocked] = useState(false);
  const [creatingSlow, setCreatingSlow] = useState(false);
  const [creatingAlert, setCreatingAlert] = useState<CreatingAlert>(null);
  const [commitTick, setCommitTick] = useState(0);
  const saveTimer = useRef(0);
  const signingIn = useRef(false);

  useEffect(() => {
    const id = readDraftId();
    const restored = restoreOnboardingDraft(readOnboardingDraftRaw(), initialPlan);
    const nextStep = stepFromStored(readOnboardingStep(), Boolean(id));
    queueMicrotask(() => {
      setDraftId(id);
      setData(restored);
      setStep(nextStep);
      if (nextStep === "code") setResendSeconds(0);
    });
  }, [initialPlan]);

  useEffect(() => {
    if (step !== "code" || resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds, step]);

  useEffect(() => {
    if (step !== "creating") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setCreatingSlow(false);
        setCreatingAlert(null);
      }
    });
    const slow = window.setTimeout(() => {
      if (!cancelled) setCreatingSlow(true);
    }, 2000);

    void (async () => {
      if (!draftId) {
        if (!cancelled) setCreatingAlert({ kind: "expired_empty" });
        return;
      }
      if (!onlineNow()) {
        if (!cancelled) setCreatingAlert({ kind: "offline" });
        return;
      }
      const result = await commitOnboardingDraft(draftId);
      if (cancelled) return;
      if (result.ok) {
        writeCommitResult({
          slug: result.slug,
          publicPath: result.publicPath,
          businessId: result.businessId || undefined,
        });
        clearOnboardingProgress();
        router.push("/onboarding/recebimento");
        return;
      }
      const follow = followUpFromFailure(result.status, result.error);
      if (follow.type === "slug_taken") {
        const slug = normalizeSlug(data.slug, { final: true });
        setLinkConflict({ slug, message: TAKEN_LATER, suggestions: follow.suggestions, source: "commit" });
        setStep("business");
        writeOnboardingStep("business");
        return;
      }
      if (follow.type === "has_business") {
        toast(HAS_BUSINESS_TOAST);
        router.push("/dashboard");
        return;
      }
      if (follow.type === "unauthorized") {
        setCodeMessage(SESSION_EXPIRED);
        setCodeStatus("error");
        setStep("code");
        writeOnboardingStep("code");
        return;
      }
      if (follow.type === "wrong_email") {
        setCodeMessage("Esse cadastro é de outro e-mail. Entre com o e-mail que você usou no começo.");
        setCodeStatus("error");
        setStep("code");
        writeOnboardingStep("code");
        return;
      }
      if (follow.type === "consumed") {
        toast("Esse cadastro já virou uma página. Abrimos o seu painel.");
        clearOnboardingProgress();
        router.push("/dashboard");
        return;
      }
      if (follow.type === "expired") {
        setCreatingAlert({ kind: "expired_local" });
        return;
      }
      if (follow.type === "offline") {
        setCreatingAlert({ kind: "offline" });
        return;
      }
      if (follow.type === "retry") {
        setCreatingAlert({ kind: "retry" });
        return;
      }
      setCreatingAlert({ kind: "generic" });
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(slow);
    };
  }, [commitTick, data.slug, draftId, router, step]);

  useEffect(() => {
    if (step !== "creating" || creatingAlert?.kind !== "offline") return;
    const retry = () => setCommitTick((current) => current + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [creatingAlert, step]);

  function update(partial: Partial<OnboardingData>) {
    setData((prev) => {
      const updated = { ...prev, ...partial };
      writeOnboardingDraft(updated);
      return updated;
    });
    setSaving(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaving(false), 300);
  }

  function go(next: OnboardingStep) {
    setStep(next);
    if (next !== "creating") writeOnboardingStep(next);
  }

  async function continueBusiness() {
    const slug = normalizeSlug(data.slug, { final: true });
    const next = { ...data, slug };
    if (slug !== data.slug) update({ slug });
    if (linkConflict?.source === "commit" && draftId && linkConflict.slug !== slug) {
      setBusinessPending(true);
      setBusinessNotice(null);
      const body = draftBodyFromOnboarding(next);
      const patched = await patchOnboardingDraft(draftId, { data: body.data });
      setBusinessPending(false);
      if (!patched.ok) {
        if (patched.error.code === "slug_unavailable") {
          setLinkConflict({ slug, message: TAKEN_LATER, suggestions: patched.error.suggestions ?? [], source: "commit" });
          return;
        }
        setBusinessNotice(patched.status === 0 ? "Sem internet. Seus dados estão salvos neste aparelho." : GENERIC);
        return;
      }
      setLinkConflict(null);
      setData(next);
      writeOnboardingDraft(next);
      setCommitTick((current) => current + 1);
      go("creating");
      return;
    }
    go("service");
  }

  async function submitEmail() {
    if (!isValidEmail(data.email)) {
      setEmailAlert({ kind: "invalid" });
      document.getElementById("onboarding-email")?.focus();
      return;
    }
    setEmailPending(true);
    setEmailAlert(null);
    const outcome = await saveDraftThenSendOtp(
      { draftId, body: draftBodyFromOnboarding(data), online: onlineNow() },
      { create: createOnboardingDraft, patch: patchOnboardingDraft, sendOtp: sendSignInOtp },
    );
    setEmailPending(false);
    if ("draftId" in outcome && outcome.draftId) {
      setDraftId(outcome.draftId);
      writeDraftId(outcome.draftId);
    }
    if (outcome.type === "code_sent") {
      setOtpEmail(data.email.trim().toLowerCase());
      setCode("");
      setCodeStatus("idle");
      setCodeMessage(null);
      setCodeLocked(false);
      setAttemptsUsed(0);
      setResendSeconds(RESEND_WAIT_SECONDS);
      go("code");
      return;
    }
    if (outcome.type === "consumed") {
      toast("Esse cadastro já virou uma página. Abrimos o seu painel.");
      clearOnboardingProgress();
      setDraftId(null);
      router.push("/dashboard");
      return;
    }
    if (outcome.type === "expired") {
      setDraftId(null);
      try {
        localStorage.removeItem("agenda_onboarding_draft_id");
      } catch {
        // localStorage indisponível.
      }
      setEmailAlert({ kind: "expired" });
      return;
    }
    if (outcome.type === "not_found") {
      setDraftId(null);
      try {
        localStorage.removeItem("agenda_onboarding_draft_id");
      } catch {
        // localStorage indisponível.
      }
      setEmailAlert({ kind: "not_found" });
      return;
    }
    if (outcome.type === "slug_taken") {
      setLinkConflict({
        slug: normalizeSlug(data.slug, { final: true }),
        message: TAKEN_LATER,
        suggestions: outcome.suggestions,
        source: draftId ? "commit" : "create",
      });
      go("business");
      return;
    }
    if (outcome.type === "rate_limited") {
      setEmailAlert({ kind: "rate", minutes: outcome.minutes });
      return;
    }
    if (outcome.type === "draft_failed") {
      setEmailAlert({ kind: "draft" });
      return;
    }
    if (outcome.type === "otp_failed") {
      setEmailAlert({ kind: "otp" });
      return;
    }
    if (outcome.type === "offline") {
      setEmailAlert({ kind: "offline" });
      return;
    }
    setEmailAlert({ kind: "generic" });
  }

  async function submitCode(value: string) {
    if (signingIn.current || codeLocked || value.length < 6) return;
    if (!onlineNow()) {
      setCodeMessage("Sem internet. Quando voltar, toque em Entrar.");
      setCodeStatus("idle");
      return;
    }
    signingIn.current = true;
    setCodeStatus("loading");
    setCodeMessage(null);
    const result = await signInWithEmailOtp(data.email, value, data.businessName);
    signingIn.current = false;
    if (!result.ok) {
      if (result.code === "network") {
        setCodeStatus("idle");
        setCodeMessage("Sem internet. Quando voltar, toque em Entrar.");
        return;
      }
      const failure = mapOtpError(result.code, attemptsUsed);
      if (failure.kind === "invalid") {
        setAttemptsUsed((current) => current + 1);
        setCode("");
        setCodeStatus("error");
        setCodeMessage(wrongCodeMessage(failure.remaining));
        return;
      }
      if (failure.kind === "locked") {
        setCodeLocked(true);
        setCode("");
        setCodeStatus("error");
        setCodeMessage(LOCKED);
        return;
      }
      if (failure.kind === "expired") {
        setCode("");
        setCodeStatus("error");
        setCodeMessage(EXPIRED);
        return;
      }
      if (failure.kind === "rate_limited") {
        setCodeStatus("error");
        setCodeMessage("Muitas tentativas. Espere e tente de novo.");
        return;
      }
      setCodeStatus("error");
      setCodeMessage(GENERIC);
      return;
    }
    setCodeStatus("success");
    window.setTimeout(() => {
      setCommitTick((current) => current + 1);
      go("creating");
    }, 240);
  }

  async function resendCode() {
    if (!onlineNow()) {
      setCodeMessage("Sem internet. Quando voltar, toque em Entrar.");
      return;
    }
    const sent = await sendSignInOtp(data.email);
    if (!sent.ok) {
      setCodeMessage(sent.code === "network" ? "Sem internet. Quando voltar, toque em Entrar." : GENERIC);
      setCodeStatus("error");
      return;
    }
    toast(`Novo código enviado para ${data.email}.`);
    setResendSeconds(RESEND_WAIT_SECONDS);
    setCodeLocked(false);
    setAttemptsUsed(0);
    setCode("");
    setCodeStatus("idle");
    setCodeMessage(null);
  }

  function restart() {
    clearOnboardingProgress();
    setDraftId(null);
    setData(createOnboardingData(initialPlan));
    setLinkConflict(null);
    setCreatingAlert(null);
    go("business");
  }

  const back = previousStep(step);
  const depositMode = data.depositMode ?? "30";

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto grid w-full max-w-5xl lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10 lg:px-6 lg:py-10">
        <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper md:min-h-[40rem] md:rounded-frame md:border md:border-line md:bg-surface md:shadow-[var(--shadow-card)]">
          <OnboardingTopBar
            saving={saving}
            savedOnServer={Boolean(draftId)}
            onBack={back ? () => go(back) : undefined}
          />
          <OnboardingStepper steps={STEPPER} current={stepperIndex(step)} />
          <div className="flex flex-1 flex-col" data-step={step}>
            {step === "business" && (
              <StepBusiness
                businessName={data.businessName}
                slug={data.slug}
                slugTouched={Boolean(data.slugTouched)}
                conflict={linkConflict}
                notice={businessNotice}
                pending={businessPending}
                onChangeBusinessName={(businessName) => update({ businessName })}
                onChangeSlug={(slug) => update({ slug })}
                onSlugTouched={(slugTouched) => update({ slugTouched })}
                onNext={() => void continueBusiness()}
              />
            )}
            {step === "service" && (
              <StepService
                serviceName={data.serviceName}
                durationMinutes={data.durationMinutes}
                priceCents={data.priceCents}
                depositCents={data.depositCents}
                depositMode={depositMode}
                onChangeServiceName={(serviceName) => update({ serviceName })}
                onChangeDuration={(durationMinutes) => update({ durationMinutes })}
                onChangePrice={(priceCents) => update({ priceCents })}
                onChangeDeposit={(depositCents) => update({ depositCents })}
                onChangeDepositMode={(mode) => update({ depositMode: mode })}
                onBack={() => go("business")}
                onNext={() => go("hours")}
              />
            )}
            {step === "hours" && (
              <StepHours
                openDays={data.openDays}
                opensAt={data.opensAt}
                closesAt={data.closesAt}
                onChangeOpenDays={(openDays) => update({ openDays })}
                onChangeOpensAt={(opensAt) => update({ opensAt })}
                onChangeClosesAt={(closesAt) => update({ closesAt })}
                onBack={() => go("service")}
                onNext={() => go("email")}
              />
            )}
            {step === "email" && (
              <StepEmail
                email={data.email}
                onChangeEmail={(email) => {
                  setEmailAlert(null);
                  update({ email });
                }}
                pending={emailPending}
                alert={emailAlert}
                replacesPreviousCode={Boolean(otpEmail) && otpEmail !== data.email.trim().toLowerCase()}
                legalPagesPublished={legalPagesPublished}
                onBack={() => go("hours")}
                onSubmit={() => void submitEmail()}
              />
            )}
            {step === "code" && (
              <StepCode
                email={data.email}
                code={code}
                onChangeCode={(value) => {
                  setCode(value);
                  if (codeStatus === "error") setCodeStatus("idle");
                }}
                onComplete={(value) => void submitCode(value)}
                status={codeStatus}
                message={codeMessage}
                resendSeconds={resendSeconds}
                pending={codeStatus === "loading"}
                locked={codeLocked}
                onResend={() => void resendCode()}
                onChangeEmail={() => go("email")}
                onBack={() => go("email")}
              />
            )}
            {step === "creating" && (
              <StepCreating
                slow={creatingSlow}
                alert={creatingAlert}
                onRetry={() => setCommitTick((current) => current + 1)}
                onContinueLocal={() => {
                  setDraftId(null);
                  try {
                    localStorage.removeItem("agenda_onboarding_draft_id");
                  } catch {
                    // ignore
                  }
                  setCreatingAlert(null);
                  go("email");
                }}
                onRestart={restart}
                onSignInAgain={() => {
                  setCreatingAlert(null);
                  setCodeMessage(SESSION_EXPIRED);
                  go("code");
                }}
              />
            )}
          </div>
          {step === "creating" ? null : (
            <p className="px-5 pb-4 text-center text-sm text-muted">
              Já tem conta? <Link href="/login" className="inline-flex min-h-11 items-center px-1 font-semibold text-ink underline-offset-4 hover:underline">Entrar</Link>
            </p>
          )}
        </div>
        <OnboardingPreview data={data} />
      </div>
    </div>
  );
}
