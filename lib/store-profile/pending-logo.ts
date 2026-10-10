/** Arquivo escolhido no cadastro, antes de existir negócio. Só nesta aba, até recarregar. */
const PENDING_LOGO_KEY = "agenda_onboarding_logo";

export const LOGO_RELOAD_MESSAGE = "A página recarregou e a logo não veio junto. Escolha o arquivo de novo.";

let pending: File | null = null;

function dropStoredLogo() {
  try {
    sessionStorage.removeItem(PENDING_LOGO_KEY);
  } catch {
    // Sem sessionStorage não há o que apagar. O arquivo não vai para lá.
  }
}

export function rememberPendingLogo(file: File | null) {
  pending = file;
  dropStoredLogo();
}

export function peekPendingLogo(): File | null {
  dropStoredLogo();
  return pending;
}

export function clearPendingLogo() {
  pending = null;
  dropStoredLogo();
}
