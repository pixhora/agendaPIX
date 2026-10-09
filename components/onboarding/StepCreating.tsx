"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CreatingAlert =
  | { kind: "offline" }
  | { kind: "retry" }
  | { kind: "generic" }
  | { kind: "expired_local" }
  | { kind: "expired_empty" }
  | { kind: "unauthorized" }
  | null;

function alertCopy(alert: CreatingAlert): string | null {
  if (!alert) return null;
  if (alert.kind === "offline") return "Sem internet. Sua conta está pronta; a página é criada assim que a conexão voltar.";
  if (alert.kind === "retry") return "Não conseguimos criar sua página agora. Seus dados estão guardados.";
  if (alert.kind === "expired_local") return "Seu cadastro guardado venceu, mas os dados ainda estão neste aparelho.";
  if (alert.kind === "expired_empty") return "Seu cadastro guardado venceu (7 dias). Vamos começar de novo? Leva poucos minutos.";
  if (alert.kind === "unauthorized") return "Sua sessão expirou. Entre de novo com um código.";
  return "Algo deu errado do nosso lado. Seus dados estão guardados; tente de novo.";
}

export function StepCreating({
  slow,
  alert,
  onRetry,
  onContinueLocal,
  onRestart,
  onSignInAgain,
}: {
  slow: boolean;
  alert: CreatingAlert;
  onRetry: () => void;
  onContinueLocal: () => void;
  onRestart: () => void;
  onSignInAgain: () => void;
}) {
  const message = alertCopy(alert);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center" aria-live="polite">
      {message ? (
        <div role="alert" className="w-full max-w-sm space-y-4">
          <p className="text-sm font-medium text-danger">{message}</p>
          {alert?.kind === "expired_local" ? (
            <Button type="button" size="lg" className="w-full" onClick={onContinueLocal}>Continuar com estes dados</Button>
          ) : null}
          {alert?.kind === "expired_empty" ? (
            <Button type="button" size="lg" className="w-full" onClick={onRestart}>Começar</Button>
          ) : null}
          {alert?.kind === "unauthorized" ? (
            <Button type="button" size="lg" className="w-full" onClick={onSignInAgain}>Entrar de novo</Button>
          ) : null}
          {alert && alert.kind !== "expired_local" && alert.kind !== "expired_empty" && alert.kind !== "unauthorized" ? (
            <Button type="button" size="lg" className="w-full" onClick={onRetry}>Tentar de novo</Button>
          ) : null}
        </div>
      ) : (
        <>
          <Loader2 aria-hidden="true" className="size-8 animate-spin text-pix motion-reduce:animate-none" />
          <p className="font-display text-xl font-bold">{slow ? "Quase lá. Estamos separando seu link." : "Criando sua página…"}</p>
        </>
      )}
    </div>
  );
}
