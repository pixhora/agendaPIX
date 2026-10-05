import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stroke e tamanhos homologados (pesquisa visual → docs/design-refs/icons/). */
export const ICON_STROKE = 1.75 as const;

export const ICON_SIZE = {
  /** Inline, campos de formulário, meta de cards */
  sm: 16,
  /** Botões com texto, itens de lista, empty, KPI glyph */
  md: 20,
  /** Navegação do painel (sidebar / abas) */
  lg: 24,
  /** Herói (confirmação / status terminal) */
  xl: 32,
} as const;

export type IconSize = keyof typeof ICON_SIZE;

type AppIconProps = Omit<LucideProps, "size" | "strokeWidth" | "absoluteStrokeWidth"> & {
  icon: LucideIcon;
  /** sm=16 · md=20 · lg=24 · xl=32. Padrão: sm. */
  size?: IconSize;
  /** Decorativo por padrão (aria-hidden). Em botão só-ícone, passe decorative={false} e aria-label no botão. */
  decorative?: boolean;
};

/**
 * Wrapper único do lucide-react: stroke 1.75 + absoluteStrokeWidth,
 * tamanhos tipados e cor herdada (use text-muted no pai quando for apoio).
 */
export function Icon({
  icon: Comp,
  size = "sm",
  className,
  decorative = true,
  ...rest
}: AppIconProps) {
  return (
    <Comp
      size={ICON_SIZE[size]}
      strokeWidth={ICON_STROKE}
      absoluteStrokeWidth
      aria-hidden={decorative ? true : undefined}
      className={cn("shrink-0", className)}
      {...rest}
    />
  );
}

/** Atalho tipado: `const ClockIcon = createIcon(Clock)`. */
export function createIcon(icon: LucideIcon) {
  function NamedIcon(props: Omit<AppIconProps, "icon">) {
    return <Icon icon={icon} {...props} />;
  }
  NamedIcon.displayName = `Icon(${icon.displayName ?? "Lucide"})`;
  return NamedIcon;
}
