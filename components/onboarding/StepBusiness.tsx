"use client";

import { useState } from "react";
import { FieldError } from "@/components/ui/field";
import { SlugInput, type SlugVisualStatus } from "@/components/ui/slug-input";
import { isPublicSlug, normalizeSlug } from "@/lib/slug";
import { StepActions } from "./chrome";
import { StepHeader } from "./parts";
import { useSlugAvailability } from "./use-slug-availability";

const FORMAT_HINT = "Use letras, números e hífen. Acentos e espaços a gente ajusta.";
const PERMANENT_HINT = "Esse é o endereço que você vai divulgar. Por enquanto, ele não pode ser trocado pelo painel.";
const NAME_ERROR = "Digite o nome do seu negócio.";
const SHORT_ERROR = "Use pelo menos 3 caracteres.";
const CHECKING = "Verificando…";
const AVAILABLE = "Disponível. É seu!";
const TAKEN = "Esse link já é de outra página. Escolha um destes ou ajuste o seu:";
const NETWORK = "Não conseguimos verificar agora. Você pode continuar; a gente confere de novo no fim.";
const OFFLINE = "Sem internet. A gente confere o link quando a conexão voltar.";

function reservedMessage(suggestion?: string) {
  return suggestion ? `Esse nome é reservado. Tente outro, como ${suggestion}.` : "Esse nome é reservado. Tente outro.";
}

export function StepBusiness({
  businessName,
  slug,
  slugTouched,
  onChangeBusinessName,
  onChangeSlug,
  onSlugTouched,
  onBack,
  onNext,
  conflict,
  notice,
  pending,
  publicHost,
}: {
  businessName: string;
  slug: string;
  slugTouched: boolean;
  onChangeBusinessName: (name: string) => void;
  onChangeSlug: (slug: string) => void;
  onSlugTouched: (touched: boolean) => void;
  onBack?: () => void;
  onNext: () => void;
  conflict?: { slug: string; message: string; suggestions: string[] } | null;
  notice?: string | null;
  pending?: boolean;
  publicHost: string;
}) {
  const host = publicHost;
  const check = useSlugAvailability(slug);
  const [nameBlurred, setNameBlurred] = useState(false);
  const [slugBlurred, setSlugBlurred] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const finalSlug = normalizeSlug(slug, { final: true });
  const nameOk = businessName.trim().length >= 2 && businessName.trim().length <= 120;
  const showNameError = (nameBlurred || attempted) && !nameOk;
  const forced = conflict && conflict.slug === finalSlug ? conflict : null;
  const status: SlugVisualStatus = forced ? "taken" : check.status;
  const showShort = status === "short" && (slugBlurred || attempted);
  const visualStatus: SlugVisualStatus = status === "short" && !showShort ? "idle" : status === "invalid" && !(slugBlurred || attempted) ? "idle" : status;
  const suggestions = forced?.suggestions ?? (visualStatus === "taken" ? check.suggestions : []);
  const message = messageFor(visualStatus, forced?.message, check.suggestion, suggestions);
  const canContinue = nameOk && isPublicSlug(finalSlug) && !forced && (status === "available" || status === "error" || status === "offline");

  function focusFirstProblem() {
    setAttempted(true);
    const name = document.getElementById("business-name");
    const link = document.getElementById("business-slug");
    if (!nameOk) {
      name?.focus();
      return;
    }
    link?.focus();
  }

  return (
    <form
      className="flex flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const finalized = normalizeSlug(slug, { final: true });
        if (finalized !== slug) onChangeSlug(finalized);
        if (!canContinue) {
          focusFirstProblem();
          return;
        }
        onNext();
      }}
    >
      <div className="flex-1 space-y-5 px-5 pt-6 pb-4">
        <StepHeader title="Nome e link da sua página" description="O link é o que você manda no WhatsApp e coloca na bio." />
        {notice ? <p role="alert" className="rounded-field border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger">{notice}</p> : null}

        <div className="grid gap-1.5">
          <label htmlFor="business-name" className="text-sm font-semibold">Nome do negócio</label>
          <input
            id="business-name"
            value={businessName}
            autoComplete="organization"
            autoCapitalize="words"
            maxLength={120}
            aria-invalid={showNameError ? true : undefined}
            aria-describedby={showNameError ? "business-name-error" : undefined}
            onBlur={() => setNameBlurred(true)}
            onChange={(event) => {
              const next = event.target.value;
              onChangeBusinessName(next);
              if (!slugTouched) onChangeSlug(normalizeSlug(next, { final: true }));
            }}
            className="min-h-12 w-full rounded-field border border-line-strong/60 bg-surface px-3.5 text-base text-ink outline-none focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-invalid:border-danger"
          />
          <FieldError id="business-name-error">{showNameError ? NAME_ERROR : null}</FieldError>
        </div>

        <div className="grid gap-2">
          <label htmlFor="business-slug" className="text-sm font-semibold">Seu link</label>
          <SlugInput
            id="business-slug"
            host={host}
            value={slug}
            status={visualStatus}
            message={message}
            suggestions={visualStatus === "taken" ? suggestions : []}
            describedBy="business-slug-permanent"
            onValueChange={(next) => {
              if (!slugTouched) onSlugTouched(true);
              onChangeSlug(next);
            }}
            onBlur={() => setSlugBlurred(true)}
            onPickSuggestion={(suggestion) => {
              check.rememberAvailable(suggestion);
              onSlugTouched(true);
              onChangeSlug(suggestion);
            }}
          />
          {visualStatus === "idle" || visualStatus === "pending" ? <p className="text-sm text-muted">{FORMAT_HINT}</p> : null}
          {slugTouched ? (
            <button
              type="button"
              onClick={() => {
                onSlugTouched(false);
                onChangeSlug(normalizeSlug(businessName, { final: true }));
              }}
              className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Usar o nome do negócio
            </button>
          ) : null}
          <p id="business-slug-permanent" className="text-sm text-muted">{PERMANENT_HINT}</p>
        </div>
      </div>
      <StepActions submitLabel="Continuar" disabled={!canContinue} pending={pending} onInvalid={focusFirstProblem} onBack={onBack} />
    </form>
  );
}

function messageFor(status: SlugVisualStatus, forced: string | undefined, suggestion: string | undefined, suggestions: string[]) {
  if (forced && status === "taken") return forced;
  if (status === "checking") return CHECKING;
  if (status === "available") return AVAILABLE;
  if (status === "taken") return TAKEN;
  if (status === "reserved") return reservedMessage(suggestion ?? suggestions[0]);
  if (status === "short") return SHORT_ERROR;
  if (status === "invalid") return FORMAT_HINT;
  if (status === "error") return NETWORK;
  if (status === "offline") return OFFLINE;
  return null;
}
