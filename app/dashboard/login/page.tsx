import { LoginForm } from "@/components/dashboard/login-form";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm linkError={!!error} />;
}
