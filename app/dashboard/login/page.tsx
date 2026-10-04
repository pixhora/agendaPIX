import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { LoginForm } from "@/components/dashboard/login-form";

const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className={`${display.variable} ${sans.variable}`}><LoginForm linkError={!!error} /></div>;
}
