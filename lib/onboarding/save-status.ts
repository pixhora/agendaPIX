/** Local draft write finished. The server copy uses a different sentence. */
export function onboardingSaveStatus(saving: boolean, savedOnServer: boolean): string {
  if (saving) return "Salvando…";
  if (savedOnServer) return "Cadastro guardado";
  return "Salvo neste aparelho";
}
