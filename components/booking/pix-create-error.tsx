import { PIX_CREATE_FAILED_COPY, PIX_CREATE_FAILED_STORE } from "./customer-copy";

/** Segunda falha ao criar o Pix. Sem WhatsApp da loja, a frase fica e o link não. */
export function PixCreateStoreLine({ href }: { href: string | null }) {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-line-strong underline-offset-4"
      >
        {PIX_CREATE_FAILED_STORE}
      </a>
    );
  }
  return <p className="font-semibold text-ink">{PIX_CREATE_FAILED_STORE}</p>;
}

export function PixCreateFailureAlert({ repeated, storeHref }: { repeated: boolean; storeHref: string | null }) {
  return (
    <div role="alert" className="space-y-3 rounded-card border border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger">
      <p>{PIX_CREATE_FAILED_COPY}</p>
      {repeated ? <PixCreateStoreLine href={storeHref} /> : null}
    </div>
  );
}
