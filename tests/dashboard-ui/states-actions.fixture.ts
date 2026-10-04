import type { FormState } from "../../lib/dashboard/validation";

declare global { interface Window { qaActionFailure?: boolean } }
async function response(success: string): Promise<FormState> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return window.qaActionFailure ? { error: "Não foi possível salvar. Confira os dados e tente novamente." } : { success };
}
// Apenas harness de UI. Nenhuma gravação, sessão ou email real.
export async function saveService(): Promise<FormState> { return response("Serviço salvo."); }
export async function saveHours(): Promise<FormState> { return response("Horários de funcionamento salvos."); }
