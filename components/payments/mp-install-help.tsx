"use client";

import { useSyncExternalStore } from "react";
import { ExternalLink } from "lucide-react";
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
    <details className="rounded-card border border-line bg-surface p-4 text-sm">
      <summary className="min-h-11 cursor-pointer font-semibold">Ainda não tenho Mercado Pago</summary>
      <ol className="mt-3 grid list-decimal gap-2 pl-5 text-muted">
        <li>Instale o app Mercado Pago no seu celular.</li>
        <li>Crie a conta com seu CPF e os dados do seu negócio. Você pode usar o mesmo e-mail do AgendaPix.</li>
        <li>Volte aqui e toque em “Conectar Mercado Pago”.</li>
      </ol>
      <div className="mt-4 grid gap-2">
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
    </details>
  );
}
