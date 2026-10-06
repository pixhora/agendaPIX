import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const NICHES = ["Barbearias", "Salões", "Manicures", "Estética", "Clínicas", "Personal trainers"];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="bg-dots absolute inset-x-0 top-0 h-[520px] opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pt-16 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold shadow-[var(--shadow-card)]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-pix" />
            Agenda online com sinal no Pix
          </p>
          <h1 className="mt-5 font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Seu cliente agenda sozinho e paga o sinal no <span className="text-pix">Pix</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Mande seu link no WhatsApp ou no Instagram. O cliente escolhe o horário, paga o sinal e a vaga fica confirmada. Sem furo e sem cobrar comprovante.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/onboarding" className={buttonVariants({ size: "lg", className: "w-full px-8 sm:w-auto" })}>
              Criar minha agenda grátis<ArrowRight aria-hidden="true" />
            </Link>
            <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted">
              {["7 dias grátis", "Sem cartão de crédito", "Pronto em 3 minutos"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-4 text-success" />{item}</span>
              ))}
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl sm:mt-16">
          <figure className="overflow-hidden rounded-frame border border-line bg-surface shadow-[var(--shadow-raised)]">
            <div aria-hidden="true" className="flex items-center gap-1.5 border-b border-line bg-subtle/70 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-line-strong/70" /><span className="size-2.5 rounded-full bg-line-strong/70" /><span className="size-2.5 rounded-full bg-line-strong/70" />
            </div>
            <Image src="/landing/painel-agenda.webp" width={1280} height={800} priority sizes="(min-width: 1024px) 1024px, 100vw" alt="Painel do agendaPIX: receita via Pix do dia, agendamentos confirmados e a lista de atendimentos com status do sinal." className="h-auto w-full" />
            <figcaption className="sr-only">Print real do painel do dono do negócio.</figcaption>
          </figure>
          <figure className="absolute -bottom-8 right-2 w-[34%] max-w-[220px] overflow-hidden rounded-[28px] border-[6px] border-ink bg-surface shadow-[var(--shadow-raised)] sm:-bottom-10 sm:right-6 lg:-right-8">
            <Image src="/landing/pagina-publica.webp" width={585} height={1266} sizes="220px" alt="Página pública de agendamento no celular: escolha do dia e dos horários livres." className="h-auto w-full" />
          </figure>
        </div>

        <div className="mt-16 text-center sm:mt-20">
          <p className="text-sm font-semibold text-muted">Feito para quem vive de atendimento</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {NICHES.map((niche) => <li key={niche} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium">{niche}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
