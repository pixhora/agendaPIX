/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

export const COPY_RESET_MS = 2000;

export const COPY_ERROR = "Não foi possível copiar. Selecione o código e copie.";

export type CopyDeps = {
  writeText?: (value: string) => Promise<void>;
  execCommand?: (command: string) => boolean;
  select?: () => void;
};

/** Clipboard moderno e, se falhar, seleção + execCommand. */
export async function copyValue(value: string, deps: CopyDeps): Promise<"copied" | "failed"> {
  if (!value) return "failed";

  if (deps.writeText) {
    try {
      await deps.writeText(value);
      return "copied";
    } catch {
      // Segue para o campo somente leitura.
    }
  }

  if (deps.select && deps.execCommand) {
    try {
      deps.select();
      if (deps.execCommand("copy")) return "copied";
    } catch {
      return "failed";
    }
  }

  return "failed";
}
