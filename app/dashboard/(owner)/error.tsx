"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main id="content" className="mx-auto flex min-h-[60vh] max-w-6xl items-center px-4 py-10 sm:px-8"><section className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-5 sm:p-8"><h1 className="text-2xl font-semibold sm:text-3xl">Não foi possível carregar o painel</h1><p role="alert" className="rounded-field border border-line bg-paper p-3 text-danger">Confira sua conexão e tente carregar novamente. Seus dados salvos continuam preservados.</p><Button onClick={retry}>Tentar novamente</Button></section></main>;
}
