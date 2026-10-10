/** Arquivo escolhido no cadastro, antes de existir negócio. Não entra no rascunho. */
let pending: File | null = null;

export function rememberPendingLogo(file: File | null) {
  pending = file;
}

export function peekPendingLogo(): File | null {
  return pending;
}

export function clearPendingLogo() {
  pending = null;
}
