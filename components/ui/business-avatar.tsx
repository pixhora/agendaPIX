import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { BUSINESS_AVATAR_ICON } from "@/lib/icons/registry";

type BusinessAvatarProps = {
  /** Nome do negócio (reservado para alt se a logo deixar de ser decorativa). */
  name?: string | null;
  /** URL da logo; se ausente, mostra CalendarCheck. */
  logoUrl?: string | null;
  /** md = size-11 (header público); lg = size-12 (preview). */
  size?: "md" | "lg";
  className?: string;
};

const sizeClass = { md: "size-11", lg: "size-12" } as const;

/**
 * Avatar do estabelecimento: logo se existir; senão ícone CalendarCheck
 * em quadrado arredondado (bg-pix-soft / text-pix) — sem iniciais.
 * Decorativo (`aria-hidden`): o nome acessível fica no heading ao lado.
 */
export function BusinessAvatar({ logoUrl, size = "md", className }: BusinessAvatarProps) {
  const box = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl",
    sizeClass[size],
    className,
  );

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica do negócio
      <img
        src={logoUrl}
        alt=""
        width={size === "lg" ? 48 : 44}
        height={size === "lg" ? 48 : 44}
        className={cn(box, "bg-subtle object-cover")}
        aria-hidden="true"
      />
    );
  }

  return (
    <span aria-hidden="true" className={cn(box, "bg-pix-soft text-pix")}>
      <Icon icon={BUSINESS_AVATAR_ICON} size={size === "lg" ? "lg" : "md"} />
    </span>
  );
}
