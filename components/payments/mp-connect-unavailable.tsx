import Link from "next/link";
import { BrandLink } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MP_CONNECT_UNAVAILABLE_COPY, MP_CONNECT_UNAVAILABLE_TITLE } from "@/lib/mercadopago/connect-navigation";

/** Mesmo arranjo da tela de link vencido: marca Aro, título, frase e botão em pílula. */
export function MpConnectUnavailable({ backHref }: { backHref: string }) {
  return (
    <main id="content" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center bg-paper px-4 py-10">
      <BrandLink />
      <h1 className="mt-8 font-display text-[28px] font-extrabold leading-tight tracking-tight text-ink">{MP_CONNECT_UNAVAILABLE_TITLE}</h1>
      <p className="mt-3 max-w-[36ch] text-base leading-relaxed text-muted">{MP_CONNECT_UNAVAILABLE_COPY}</p>
      <Link href={backHref} className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}>Voltar</Link>
    </main>
  );
}
