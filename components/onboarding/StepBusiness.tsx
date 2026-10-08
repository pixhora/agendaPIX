import React from "react";
import { Input } from "@/components/ui/input";
import { FieldError, FieldHint } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { slugify } from "./slug";
import { StepActions, StepHeader, usePublicHost } from "./parts";

interface StepBusinessProps {
  businessName: string;
  slug: string;
  onChangeBusinessName: (name: string) => void;
  onChangeSlug: (slug: string) => void;
  onNext: () => void;
}

export function StepBusiness({ businessName, slug, onChangeBusinessName, onChangeSlug, onNext }: StepBusinessProps) {
  const host = usePublicHost();
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChangeBusinessName(val);
    if (!slug || slug === slugify(businessName)) {
      onChangeSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeSlug(slugify(e.target.value));
  };

  const isNameStarted = businessName.length > 0;
  const isNameValid = businessName.trim().length >= 2;
  const showNameError = isNameStarted && !isNameValid;

  const isSlugStarted = slug.length > 0;
  const isSlugValid = slug.length >= 2 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const showSlugError = isSlugStarted && !isSlugValid;

  const isValid = isNameValid && isSlugValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeader title="Como se chama o seu negócio?" description="É o nome que seus clientes veem no topo da sua página de agendamento." />

      <div className="grid gap-1.5">
        <label htmlFor="business-name" className="text-sm font-semibold">Nome do negócio ou profissional</label>
        <Input
          id="business-name"
          type="text"
          required
          autoComplete="organization"
          aria-invalid={showNameError ? "true" : undefined}
          aria-describedby={showNameError ? "business-name-error" : undefined}
          placeholder="Ex.: Barbearia do Silva, Studio Ana Lash"
          value={businessName}
          onChange={handleNameChange}
        />
        <FieldError id="business-name-error">{showNameError ? "O nome deve ter pelo menos 2 caracteres." : null}</FieldError>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="business-slug" className="text-sm font-semibold">Seu link de agendamento</label>
        <div
          className={cn(
            "flex min-h-12 items-stretch overflow-hidden rounded-field border bg-surface transition-feedback focus-within:outline-2 focus-within:outline-offset-1",
            showSlugError ? "border-danger focus-within:outline-danger" : "border-line-strong/60 hover:border-line-strong focus-within:border-ink focus-within:outline-ring",
          )}
        >
          <span aria-hidden="true" className="flex max-w-[45%] shrink-0 select-none items-center truncate border-r border-line bg-subtle px-3 text-sm font-medium text-muted">
            {host}/
          </span>
          <input
            id="business-slug"
            type="text"
            required
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={showSlugError ? "true" : undefined}
            aria-describedby={showSlugError ? "business-slug-error" : "business-slug-hint"}
            placeholder="seu-negocio"
            value={slug}
            onChange={handleSlugChange}
            className="min-w-0 flex-1 bg-transparent px-3 text-base text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        {showSlugError ? (
          <FieldError id="business-slug-error">
            {slug.length < 2 ? "O link deve ter pelo menos 2 caracteres." : "Use só letras minúsculas, números e hífens."}
          </FieldError>
        ) : (
          <FieldHint id="business-slug-hint">Letras minúsculas, números e hífens. Dá para mudar depois.</FieldHint>
        )}
      </div>

      <StepActions submitLabel="Continuar" disabled={!isValid} />
    </form>
  );
}
