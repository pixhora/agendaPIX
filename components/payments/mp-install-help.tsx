"use client";

import { useSyncExternalStore } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { MP_APP_STORE_URL, MP_PLAY_STORE_SEARCH_URL, mpStorePlatform } from "@/lib/mercadopago/install-help";

/** Para quem ainda não tem Mercado Pago: instruções curtas e o botão da loja do celular dela. */
export function MpInstallHelp() {
  // Lê o aparelho no cliente; no servidor não há como saber, então mostramos as duas lojas.
  const platform = useSyncExternalStore(() => () => undefined, () => mpStorePlatform(navigator.userAgent, navigator.maxTouchPoints), () => null);

  const stores = platform === "android"
    ? [{ url: MP_PLAY_STORE_SEARCH_URL, label: "Abrir na Google Play" }]
    : platform === "ios"
      ? [{ url: MP_APP_STORE_URL, label: "Abrir na App Store" }]
      : [
          { url: MP_PLAY_STORE_SEARCH_URL, label: "Google Play (Android)" },
          { url: MP_APP_STORE_URL, label: "App Store (iPhone)" },
        ];

  return (
    <details className="group mt-4 rounded-card border border-line bg-surface text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold [&::-webkit-details-marker]:hidden [&::marker]:content-none">
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        Ainda não tenho Mercado Pago
      </summary>
      <div className="grid gap-4 px-4 pb-4">
        <ol className="grid list-decimal gap-2 pl-5 text-muted">
          <li>Instale o app Mercado Pago no seu celular.</li>
          <li>Crie a conta com seu CPF e os dados do seu negócio. Você pode usar o mesmo e-mail do AgendaPix.</li>
          <li>Volte aqui e toque em “Conectar Mercado Pago”.</li>
        </ol>
        <div className="grid gap-2">
          {stores.map((store) => (
            <a
              key={store.url}
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-4 font-semibold"
            >
              {store.label}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          ))}
        </div>
      </div>
    </details>
  );
}
