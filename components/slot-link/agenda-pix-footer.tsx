import Link from "next/link";
import { BrandMark } from "@/components/ui/brand";

/** Rodapé da página pública e da reserva confirmada. O link é só "Crie a sua grátis". */
export function AgendaPixFooter({ campaign }: { campaign: "pagina_publica" | "reserva_confirmada" }) {
  const href = `/?utm_source=agendapix&utm_medium=rodape&utm_campaign=${campaign}`;
  return (
    <footer className="mx-auto mt-6 w-full max-w-5xl border-t border-line px-4 pt-6 text-center">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
        <BrandMark className="size-4 rounded-[4px]" />
        <span>Agenda com sinal no Pix feita no AgendaPix.</span>
        <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">
          Crie a sua grátis
        </Link>
      </p>
    </footer>
  );
}
