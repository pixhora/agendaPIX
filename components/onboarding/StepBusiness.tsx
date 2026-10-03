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

  const isValid = businessName.trim().length >= 2 && slug.length >= 2;

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
            placeholder="Ex: Barbearia do Silva, Studio Ana Lash..."
            value={businessName}
            onChange={handleNameChange}
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground/60 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
        </div>

        <div>
          <label htmlFor="business-slug" className="block text-sm font-medium text-foreground mb-1.5">
            Seu link personalizado
          </label>
          <div className="flex items-center rounded-lg border border-border bg-surface overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
            <span className="bg-muted px-3 py-2.5 text-xs sm:text-sm font-medium text-muted-foreground select-none">
              agenda.com.br/
            </span>
            <input
              id="business-slug"
              type="text"
              required
              placeholder="seu-negocio"
              value={slug}
              onChange={handleSlugChange}
              className="flex-1 bg-transparent px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-11"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Apenas letras minúsculas, números e hífens.
          </p>
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={!isValid}
          className="w-full min-h-11 text-base font-semibold"
        >
          Continuar
        </Button>
      </div>
    </form>
  );
}
