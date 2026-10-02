import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agenda",
  description: "Agendamento online com sinal por Pix.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
