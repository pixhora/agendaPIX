import { MessageCircle } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { SERVICE_UNAVAILABLE_MESSAGE, whatsappHref } from "./booking-error";

interface UnbookableNoticeProps {
  contactWhatsapp?: string | null;
  message?: string;
}

/** Aviso neutro. Não mostra o motivo interno da indisponibilidade. */
export function UnbookableNotice({ contactWhatsapp, message = SERVICE_UNAVAILABLE_MESSAGE }: UnbookableNoticeProps) {
  const href = whatsappHref(contactWhatsapp);

  return (
    <div role="status" data-testid="service-unbookable" className="rounded-card border border-line bg-subtle px-4 py-5 text-center">
      <p className="text-sm font-medium text-ink">{message}</p>
      {href ? (
        <Button asChild size="lg" className="mt-4 w-full">
          <a href={href}>
            <Icon icon={MessageCircle} size="md" />
            Chamar no WhatsApp
          </a>
        </Button>
      ) : null}
    </div>
  );
}
