export const PREVIEW_SCENES = ["fluxo", "dados", "pix", "pix-perto", "pix-expirado", "pix-cima-hora", "pix-cima-hora-credito", "comprovante", "indisponivel", "politica", "politica-mudou", "pausada", "cima-da-hora"] as const;

export type PreviewScene = (typeof PREVIEW_SCENES)[number];

/** Cenas estáticas do preview para o passo Pix, o resumo e o comprovante. */
export function parsePreviewScene(etapa?: string, prazo?: string): PreviewScene {
  if (etapa === "comprovante") return "comprovante";
  if (etapa === "indisponivel") return "indisponivel";
  if (etapa === "pausada" || etapa === "pausado") return "pausada";
  if (etapa === "politica-mudou" || etapa === "policy_changed") return "politica-mudou";
  if (etapa === "politica") return "politica";
  if (etapa === "cima-da-hora" || etapa === "em-cima-da-hora") return "cima-da-hora";
  if (etapa === "dados" || etapa === "resumo") return "dados";
  if (etapa === "pix" && (prazo === "expirado" || prazo === "expired")) return "pix-expirado";
  if (etapa === "pix" && (prazo === "perto" || prazo === "expirando")) return "pix-perto";
  if (etapa === "pix" && (prazo === "cima-da-hora-credito" || prazo === "credito")) return "pix-cima-hora-credito";
  if (etapa === "pix" && (prazo === "cima-da-hora" || prazo === "cima-da-hora-retain" || prazo === "retain")) return "pix-cima-hora";
  if (etapa === "pix") return "pix";
  return "fluxo";
}
