import React from "react";

export function LandingTrustBand() {
  const categories = [
    { title: "Barbearias", desc: "Corte, barba e química" },
    { title: "Salões de Beleza", desc: "Cabelo, mechas e escova" },
    { title: "Clínicas & Estética", desc: "Procedimentos e massagens" },
    { title: "Manicures & Nail Designers", desc: "Alongamento e esmaltação" },
    { title: "Personal Trainers", desc: "Aulas e consultorias" },
  ];

  return (
    <section className="border-y border-border bg-surface/50 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs font-semibold text-muted-foreground mb-5">
          Para profissionais e pequenos negócios em todo o Brasil
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 items-center">
          {categories.map((cat, idx) => (
            <div
              key={cat.title}
              className={`px-3 py-2.5 rounded-xl bg-surface border border-border text-center shadow-xs ${
                idx === 4 ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <p className="text-sm font-bold text-foreground">{cat.title}</p>
              <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
