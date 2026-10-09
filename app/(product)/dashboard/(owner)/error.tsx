"use client";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main id="content" className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-10">
    <section className="max-w-xl rounded-card border border-line bg-surface p-6 sm:p-8">
      <span aria-hidden="true" className="mb-4 flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger"><TriangleAlert className="size-5" /></span>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Não foi possível carregar o painel</h1>
      <p role="alert" className="mt-2 text-muted">Confira sua conexão e tente carregar novamente. Seus dados salvos continuam preservados.</p>
      <Button className="mt-5" onClick={retry}><RotateCcw aria-hidden="true" />Tentar novamente</Button>
    </section>
  </main>;
}
