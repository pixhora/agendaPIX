export function LandingFinalCta() {
  return (
    <section id="cta-final" aria-labelledby="cta-final-titulo" className="scroll-mt-24 px-5 pb-16 lg:pb-28">
      <div className="relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-frame bg-pix-deep px-5 py-12 text-center sm:px-10 sm:py-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(color-mix(in srgb, var(--pix-bright) 55%, transparent) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="relative">
          <h2 id="cta-final-titulo" className="mx-auto max-w-[22rem] font-display text-[1.75rem] font-bold leading-[1.08] tracking-[-0.025em] text-slab-foreground sm:max-w-[36rem] lg:text-[2.75rem]">
            Sua próxima reserva pode chegar com o sinal pago.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-pix-deep-muted lg:text-lg">Crie sua página agora. São 7 dias grátis, sem cartão. O sinal cai direto na sua conta Mercado Pago.</p>
          <a
            href="/onboarding"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-6 text-base font-semibold text-pix-bright-foreground transition-feedback hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
          >
            Criar minha agenda grátis
          </a>
        </div>
      </div>
    </section>
  );
}
