import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bookingConfig } from "@/lib/bookings/config";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BookingIsland } from "@/components/motion/booking-island";
import { CopyButton } from "@/components/motion/copy-button";
import { CountdownRing } from "@/components/motion/countdown-ring";
import { GradeLoader } from "@/components/motion/grade-loader";
import { RollingNumber } from "@/components/motion/rolling-number";
import { SegmentedThumb } from "@/components/motion/segmented-thumb";
import { isMotionPreviewOpen } from "@/app/preview/motion/access";
import { ThemeAppearanceDemo } from "@/app/preview/motion/theme-demo";

export const metadata: Metadata = {
  title: "Movimento",
  robots: { index: false, follow: false },
};

const depositCents = 1500;
const pixCode = "00020126580014br.gov.bcb.pix0136preview-agendapix520400005303986540515.005802BR5910AgendaPix6009SAO PAULO62070503***6304ABCD";

const durations = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];

const loaderSizes = [24, 32, 64] as const;

function GradeLoaderStage({ tone, title }: { tone: "light" | "dark"; title: string }) {
  const stageClass = tone === "light"
    ? "bg-[#f6f5f2] text-[#0b0b0c] [--brand-tile-edge:transparent]"
    : "bg-[#0f0f10] text-[#f6f5f2] [--brand-tile-edge:rgb(255_255_255_/_0.14)]";

  return (
    <div className={`space-y-5 rounded-card p-4 ${stageClass}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap items-end gap-6">
        <figure className="space-y-2">
          <GradeLoader />
          <figcaption className="text-sm">Loop</figcaption>
        </figure>
        <figure className="space-y-2">
          <GradeLoader loop={false} />
          <figcaption className="text-sm">Uma vez</figcaption>
        </figure>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {loaderSizes.map((size) => (
          <figure key={size} className="space-y-2">
            <GradeLoader size={size} label={`Carregando, ${size} pixels`} />
            <figcaption className="text-sm tabular-nums">{size}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default function MotionPreviewPage() {
  if (!isMotionPreviewOpen(process.env.NODE_ENV)) notFound();
  const holdMinutes = bookingConfig().BOOKING_HOLD_MINUTES;

  return (
    <div className="min-h-screen bg-paper px-4 pt-16 pb-24 text-ink">
      <main className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[62ch] space-y-2">
            <p>
              <Link href="/preview" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline decoration-line underline-offset-4">Voltar ao preview</Link>
            </p>
            <h1 className="font-display text-[28px] font-bold tracking-tight">Movimento</h1>
            <p className="text-base text-muted">
              Números, aviso de reserva, copiar código, escolha única, tempo do Pix e a marca Aro carregando. Estes blocos ainda não entram nas telas do produto.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <section aria-labelledby="valores-heading" className="space-y-4">
          <h2 id="valores-heading" className="font-display text-xl font-bold">Valores</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-card bg-surface p-4 shadow-card ring-1 ring-line">
              <p className="text-sm text-muted">Sinal</p>
              <RollingNumber id="preview-deposit" value={depositCents} format="currency" className="mt-2 font-display text-[40px] font-bold" />
            </article>
            <article className="rounded-card bg-surface p-4 shadow-card ring-1 ring-line">
              <p className="text-sm text-muted">Tempo para pagar o sinal</p>
              <RollingNumber id="preview-hold" value={holdMinutes} suffix=" minutos" className="mt-2 font-display text-[40px] font-bold" />
            </article>
          </div>
        </section>

        <section aria-labelledby="reserva-heading" className="space-y-4">
          <h2 id="reserva-heading" className="font-display text-xl font-bold">Nova reserva</h2>
          <BookingIsland
            compactLabel="Nova reserva"
            guestName="Ana"
            serviceName="Corte feminino"
            whenLabel="sex, 09 out, 14:00"
            statusLabel="Confirmado · sinal pago"
            label="Nova reserva de Ana: Corte feminino, sex, 09 out, 14:00. Confirmado, sinal pago."
          />
        </section>

        <section aria-labelledby="codigo-heading" className="space-y-4">
          <h2 id="codigo-heading" className="font-display text-xl font-bold">Código Pix</h2>
          <div className="max-w-xl space-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-line">
            <p className="text-sm break-all text-ink tabular-nums">{pixCode}</p>
            <CopyButton value={pixCode} />
          </div>
        </section>

        <section aria-labelledby="escolha-heading" className="space-y-6">
          <h2 id="escolha-heading" className="font-display text-xl font-bold">Escolha única</h2>
          <form className="max-w-md space-y-2">
            <p className="text-sm font-semibold text-ink">Duração do serviço</p>
            <SegmentedThumb name="duration" label="Duração do serviço" options={durations} defaultValue="15" />
          </form>
          <div className="max-w-md">
            <ThemeAppearanceDemo />
          </div>
        </section>

        <section aria-labelledby="tempo-heading" className="space-y-4">
          <h2 id="tempo-heading" className="font-display text-xl font-bold">Tempo do sinal</h2>
          <div className="flex flex-wrap gap-8">
            <CountdownRing secondsLeft={754} totalSeconds={900} tone="normal" label="Tempo para pagar" />
            <CountdownRing secondsLeft={45} totalSeconds={900} tone="warn" label="Falta pouco" />
            <CountdownRing secondsLeft={0} totalSeconds={900} tone="expired" label="Prazo encerrado" />
          </div>
        </section>

        <section aria-labelledby="carregando-heading" className="space-y-4">
          <h2 id="carregando-heading" className="font-display text-xl font-bold">Carregando</h2>
          <p className="max-w-[62ch] text-sm text-muted">
            Marca Aro. No loop o brilho dá voltas e a haste fica parada. Na entrada, o anel acende e a haste sobe uma vez.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <GradeLoaderStage tone="light" title="Fundo claro" />
            <GradeLoaderStage tone="dark" title="Fundo escuro" />
          </div>
        </section>
      </main>
    </div>
  );
}
