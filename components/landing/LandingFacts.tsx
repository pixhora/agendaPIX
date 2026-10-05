const FACTS = [
  { value: "15 min", label: "para o cliente pagar o sinal. Se não pagar, o horário volta sozinho para a agenda." },
  { value: "0", label: "comprovantes para conferir no WhatsApp. A confirmação do Pix chega automaticamente." },
  { value: "24 h", label: "de agenda aberta. O cliente reserva de madrugada e você acorda com o sinal pago." },
];

export function LandingFacts() {
  return (
    <section aria-label="Por que funciona" className="border-y border-line bg-surface">
      <dl className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-3">
        {FACTS.map((fact) => (
          <div key={fact.value} className="bg-surface px-6 py-8 sm:px-8">
            <dt className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-pix">{fact.value}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted">{fact.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
