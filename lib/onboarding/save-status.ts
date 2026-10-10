/**
 * "Salvo neste aparelho" only after a local write with no server draft.
 * A blank form has no status: the sentence is not a default and does not
 * mean the fields were filled from an example.
 */
export function onboardingSaveStatus(saving: boolean, savedOnServer: boolean, savedOnDevice = false): string | null {
  if (saving) return "Salvando…";
  if (savedOnServer) return "Cadastro guardado";
  if (savedOnDevice) return "Salvo neste aparelho";
  return null;
}
