import React from "react";
import { Button } from "../ui/button";
import { slugify } from "./slug";

interface StepBusinessProps {
  businessName: string;
  slug: string;
  onChangeBusinessName: (name: string) => void;
  onChangeSlug: (slug: string) => void;
  onNext: () => void;
}

export function StepBusiness({
  businessName,
  slug,
  onChangeBusinessName,
  onChangeSlug,
  onNext,
}: StepBusinessProps) {
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
    if (isValid) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">
          Qual é o nome do seu negócio?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus clientes verão esse nome no topo da sua página de agendamentos.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="business-name" className="block text-sm font-medium text-foreground mb-1.5">
            Nome do estabelecimento ou profissional
          </label>
          <input
            id="business-name"
            type="text"
            required
            aria-invalid={showNameError ? "true" : undefined}
            aria-describedby={showNameError ? "business-name-error" : undefined}
            placeholder="Ex: Barbearia do Silva, Studio Ana Lash..."
            value={businessName}
            onChange={handleNameChange}
            className={`w-full rounded-lg border bg-surface px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground/60 min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 ${
              showNameError
                ? "border-destructive focus-visible:outline-destructive"
                : "border-border focus-visible:outline-primary"
            }`}
          />
          {showNameError && (
            <div
              id="business-name-error"
              role="alert"
              className="mt-1.5 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive font-medium transition-all duration-180 ease-out motion-reduce:transition-none"
            >
              O nome do estabelecimento deve ter pelo menos 2 caracteres.
            </div>
          )}
        </div>

        <div>
          <label htmlFor="business-slug" className="block text-sm font-medium text-foreground mb-1.5">
            Seu link personalizado
          </label>
          <div
            className={`flex items-center rounded-lg border bg-surface overflow-hidden focus-within:ring-2 focus-within:ring-offset-2 ${
              showSlugError
                ? "border-destructive focus-within:ring-destructive"
                : "border-border focus-within:ring-primary"
            }`}
          >
            <span className="bg-muted px-3 py-3 text-xs sm:text-sm font-medium text-muted-foreground select-none">
              agenda.com.br/
            </span>
            <input
              id="business-slug"
              type="text"
              required
              aria-invalid={showSlugError ? "true" : undefined}
              aria-describedby={showSlugError ? "business-slug-error" : undefined}
              placeholder="seu-negocio"
              value={slug}
              onChange={handleSlugChange}
              className="flex-1 min-w-0 bg-transparent px-3 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-12"
            />
          </div>
          {showSlugError ? (
            <div
              id="business-slug-error"
              role="alert"
              className="mt-1.5 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive font-medium transition-all duration-180 ease-out motion-reduce:transition-none"
            >
              {slug.length < 2
                ? "O link personalizado deve ter pelo menos 2 caracteres."
                : "O link deve conter apenas letras minúsculas, números e hífens."}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Apenas letras minúsculas, números e hífens.
            </p>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={!isValid}
          className="w-full min-h-12 text-base font-semibold rounded-full transition-transform duration-120 active:scale-[0.98] motion-reduce:transform-none"
        >
          Continuar
        </Button>
      </div>
    </form>
  );
}
