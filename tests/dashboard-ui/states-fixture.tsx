import "../../app/globals.css";
import { createRoot } from "react-dom/client";
import { ServiceForm, HoursForm } from "../../components/dashboard/forms";
import { PixKeyForm } from "../../components/dashboard/pix-key-form";
import { BookingStatus } from "../../components/dashboard/booking-status";

createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-3xl space-y-8 p-4">
  <h1 className="text-2xl font-semibold">Prova isolada de estados do painel</h1>
  <ServiceForm businessId="business-test" />
  <HoursForm businessId="business-test" hours={[]} />
  <PixKeyForm businessId="business-test" />
  <BookingStatus status="confirmed" />
</main>);
