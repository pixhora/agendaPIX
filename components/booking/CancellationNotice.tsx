import { cancellationNoticeText } from "./cancellation-policy";

interface CancellationNoticeProps {
  policy?: string | null;
  businessName: string;
}

/** Política do serviço, ou um aviso neutro quando o campo vem vazio. */
export function CancellationNotice({ policy, businessName }: CancellationNoticeProps) {
  return (
    <div data-testid="cancellation-notice" className="rounded-field bg-subtle px-4 py-3">
      <p className="text-sm font-semibold text-ink">Se faltar ou cancelar</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{cancellationNoticeText(policy, businessName)}</p>
    </div>
  );
}
