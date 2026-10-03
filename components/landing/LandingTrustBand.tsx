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
    <section className="border-y border-[#E2E6DF] bg-white/60 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#5A645C] mb-5">
          Concebido para profissionais e pequenos negócios em todo o Brasil
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center">
          {categories.map((cat) => (
            <div
              key={cat.title}
              className="px-3 py-2 rounded-xl bg-[#F5F6F2]/70 border border-[#E2E6DF]/80 text-center"
            >
              <p className="text-sm font-bold text-[#111613]">{cat.title}</p>
              <p className="text-[11px] text-[#5A645C]">{cat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
