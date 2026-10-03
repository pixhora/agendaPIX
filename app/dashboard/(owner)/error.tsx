"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main id="content" className="mx-auto max-w-6xl space-y-4 p-8"><h1 className="text-[28px] font-semibold">Não foi possível carregar o painel</h1><p role="alert">Confira sua conexão e tente carregar novamente. Seus dados salvos continuam preservados.</p><Button onClick={retry}>Tentar novamente</Button></main>;
}
