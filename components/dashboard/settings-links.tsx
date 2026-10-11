import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { ACTION_ICONS } from "@/lib/icons/registry";

const smallLink = "whitespace-nowrap text-sm text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** No celular, os links do topo ficam no fim de Configurações. No desktop eles seguem no cabeçalho. */
export function SettingsPanelLinks({
  legalPagesPublished,
  supportWhatsappHref,
}: {
  legalPagesPublished: boolean;
  supportWhatsappHref: string | null;
}) {
  if (!legalPagesPublished && !supportWhatsappHref) return null;
  return (
    <div className="grid gap-4 md:hidden">
      {supportWhatsappHref ? (
        <a
          href={supportWhatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-3 rounded-card border border-line bg-surface px-4 py-4 text-base font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">
            <Icon icon={ACTION_ICONS.whatsapp} size="md" />
          </span>
          Suporte no WhatsApp
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      ) : null}
      <nav aria-label="AgendaPix" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {legalPagesPublished ? <Link href="/termos" className={smallLink}>Termos de uso</Link> : null}
        {legalPagesPublished ? <Link href="/privacidade" className={smallLink}>Política de privacidade</Link> : null}
        {supportWhatsappHref ? (
          <a href={supportWhatsappHref} target="_blank" rel="noopener noreferrer" className={smallLink}>
            Suporte no WhatsApp
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : null}
      </nav>
    </div>
  );
}
