"use client";

import { PixChargeFailedScreen } from "./pix-charge-failed";
import { StepCustomer } from "./StepCustomer";

const service = {
  id: "00000000-0000-4000-8000-0000000000c2",
  name: "Corte",
  durationMinutes: 30,
  priceCents: 5000,
  depositCents: 50,
  bookable: true,
};

const slot = {
  startsAt: "2030-10-18T18:00:00.000Z",
  endsAt: "2030-10-18T18:30:00.000Z",
};

/** Só em desenvolvimento, para o print do botão travado e da recusa do Pix. */
export function PixChargeFixture({ scene }: { scene: "generating" | "failed" }) {
  return (
    <main className="min-h-dvh bg-paper">
      <div className="mx-auto w-full max-w-[480px] px-5 py-6">
        {scene === "generating" ? (
          <StepCustomer
            service={service}
            slot={slot}
            timezone="America/Sao_Paulo"
            name="Matheus"
            phone="(11) 98888-7777"
            cpf=""
            isSubmitting
            errorMessage={null}
            onChangeName={() => undefined}
            onChangePhone={() => undefined}
            onChangeCpf={() => undefined}
            onBack={() => undefined}
            onSubmit={() => undefined}
            requiresPayerCpf={false}
          />
        ) : (
          <PixChargeFailedScreen storeHref="https://wa.me/5511988887777" retrying={false} onRetry={() => undefined} />
        )}
      </div>
    </main>
  );
}
